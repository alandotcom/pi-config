import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream, getCurrentSystemMessage } from "@earendil-works/pi-ai";
import recall from "../extensions/recall.ts";

type Entry = Record<string, unknown>;

function message(id: string, text: string, timestamp: string, parentId: string | null = null, content?: unknown[]): Entry {
	return {
		type: "message",
		id,
		parentId,
		timestamp,
		message: { role: "user", content: content ?? [{ type: "text", text }] },
	};
}

async function invoke({ entries, file, header, query = "sqlite fts", limit = 10 }: { entries: Entry[]; file?: string; header?: Entry; query?: string; limit?: number }) {
	let tool: any;
	recall({ registerTool(value: any) { tool = value; }, on() {} } as any);
	const context = {
		sessionManager: {
			getEntries: () => entries,
			getBranch: () => [{ type: "compaction" }, ...entries],
			getSessionFile: () => file,
			getHeader: () => header,
		},
	};
	return tool.execute("test", { query, limit }, undefined, undefined, context);
}

async function sessionFile(path: string, id: string, entries: Entry[], parentSession?: string) {
	await writeFile(path, [
		JSON.stringify({ type: "session", id, timestamp: "2025-01-01T00:00:00.000Z", parentSession }),
		...entries.map((entry) => JSON.stringify(entry)),
	].join("\n") + "\n");
}

function resultText(result: any): string {
	return result.content[0].text;
}

async function withHost(run: (session: Awaited<ReturnType<typeof createAgentSession>>["session"], manager: SessionManager) => Promise<void>, compacted = false, extensions: ((pi: ExtensionAPI) => void)[] = []) {
	const directory = await mkdtemp(join(tmpdir(), "recall-host-"));
	const settingsManager = SettingsManager.inMemory({ packages: [] });
	const resources = new DefaultResourceLoader({
		cwd: directory, agentDir: directory, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true,
		extensionFactories: [recall, ...extensions],
	});
	try {
		await resources.reload();
		const manager = SessionManager.inMemory(directory);
		const first = manager.appendMessage({ role: "user", content: "history-probe", timestamp: Date.now() });
		manager.appendMessage({
			role: "assistant", content: [{ type: "text", text: "History recorded" }], api: "anthropic-messages", provider: "test", model: "test",
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			stopReason: "stop", timestamp: Date.now(),
		});
		if (compacted) manager.appendCompaction("Earlier history", first, 100);
		const { session } = await createAgentSession({ cwd: directory, agentDir: directory, settingsManager, resourceLoader: resources, sessionManager: manager });
		try {
			await session.bindExtensions({ mode: "json", onError(error) { throw new Error(error.error); } });
			await run(session, manager);
		} finally { session.dispose(); }
	} finally { await rm(directory, { recursive: true, force: true }); }
}

// Availability is a public tool contract. The real host catches declaration and nested-call bypasses;
// existing search tests cover result contents only. No production test-only exports are needed.
test("recall stays hidden until successful compaction and follows the active branch", async () => {
	await withHost(async (session, manager) => {
		const runner = session.extensionRunner!;
		const context = () => session.extensionRunner!.createToolContext("availability", undefined);
		const visible = () => {
			assert.equal(session.getAllTools().find((tool) => tool.name === "recall")?.exposure, "direct");
			assert.ok(session.getActiveToolNames().includes("recall"));
			assert.ok(context().tools.some((tool) => tool.name === "recall"));
		};
		const hidden = async () => {
			assert.equal(session.getAllTools().find((tool) => tool.name === "recall")?.exposure, "hidden");
			assert.ok(!session.getActiveToolNames().includes("recall"));
			assert.ok(!context().tools.some((tool) => tool.name === "recall"));
			const denied = await context().executeTool("recall", { query: "history-probe" });
			assert.equal(denied.isError, true);
			assert.match(resultText(denied.result), /not found|not available|unknown tool/i);
			await assert.rejects(runner.getToolDefinition("recall")!.execute("guard", { query: "history-probe" }, undefined, undefined, context()), /unavailable until/);
		};
		const otherTools = session.getActiveToolNames();
		await hidden();
		session.setActiveToolsByName([...otherTools, "recall"]);
		await hidden();
		await runner.emit({ type: "session_before_compact", preparation: {} as any, branchEntries: manager.getBranch(), reason: "manual", willRetry: false, signal: new AbortController().signal });
		await hidden();
		for (const aborted of [false, true]) {
			await runner.emit({ type: "session_compact_failed", reason: "manual", aborted, willRetry: false, fromExtension: false });
			await hidden();
		}

		const first = manager.getLeafId()!;
		manager.appendCompaction("Earlier history", first, 100);
		const compaction = manager.getBranch().find((entry) => entry.type === "compaction")!;
		await runner.emit({ type: "session_compact", compactionEntry: compaction, fromExtension: false, reason: "manual", willRetry: false });
		visible();
		assert.deepEqual(session.getActiveToolNames().filter((name) => name !== "recall"), otherTools);
		const recalled = await context().executeTool("recall", { query: "history-probe" });
		assert.equal(recalled.isError, false);
		assert.match(resultText(recalled.result), /history-probe/);

		manager.branch(first);
		await runner.emit({ type: "session_tree", oldLeafId: compaction.id, newLeafId: first });
		await hidden();
		assert.deepEqual(session.getActiveToolNames(), otherTools);
		manager.branch(compaction.id);
		await runner.emit({ type: "session_tree", oldLeafId: first, newLeafId: compaction.id });
		visible();
		await session.reload();
		visible();
	});
});

test("recall restores availability from compacted history and stays hidden when reloaded before that compaction", async () => {
	await withHost(async (session, manager) => {
		assert.ok(session.getActiveToolNames().includes("recall"));
		const first = manager.getBranch().find((entry) => entry.type === "message")!;
		manager.branch(first.id);
		await session.reload();
		assert.ok(!session.getActiveToolNames().includes("recall"));
		assert.equal(session.getAllTools().find((tool) => tool.name === "recall")?.exposure, "hidden");
	}, true);
});

test("boundary compaction enables recall for the next response in the same run", async () => {
	for (const boundary of ["turn_end", "agent_before_settle"] as const) {
		let requests = 0;
		await withHost(async (session) => {
			await session.setModel({ id: "recall-test", name: "Recall test", api: "anthropic-messages", provider: "test", baseUrl: "http://localhost", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 1000 });
			const declared: boolean[] = [];
			const active: boolean[] = [];
			session.agent.streamFunction = (_model, context) => {
				const tools = getCurrentSystemMessage(context.messages)?.toolsAdded ?? [];
				declared.push(tools.some((tool) => tool.name === "recall"));
				active.push(session.getActiveToolNames().includes("recall"));
				requests++;
				const stream = createAssistantMessageEventStream();
				const message = {
					role: "assistant" as const,
					content: requests === 2 ? [{ type: "toolCall" as const, id: "boundary-recall", name: "recall", arguments: { query: "Earlier context" } }] : [{ type: "text" as const, text: "Response" }],
					api: "anthropic-messages" as const, provider: "test", model: "recall-test",
					usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
					stopReason: requests === 2 ? "toolUse" as const : "stop" as const, timestamp: Date.now(),
				};
				stream.push({ type: "done", reason: message.stopReason, message });
				return stream;
			};
			await session.prompt("Continue after boundary compaction");
			assert.equal(requests, 3);
			assert.deepEqual(declared, [false, true, true], `${boundary}: provider declarations`);
			assert.deepEqual(active, [false, true, true], `${boundary}: active tools`);
			const result = session.messages.find((entry) => entry.role === "toolResult" && entry.toolCallId === "boundary-recall");
			assert.ok(result?.role === "toolResult");
			assert.equal(result.isError, false);
			assert.match(resultText(result), /Earlier context/);
		}, false, [(pi) => {
			pi.registerProvider("test", { baseUrl: "http://localhost", apiKey: "test-key", api: "anthropic-messages", models: [{ id: "recall-test", name: "Recall test", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 1000 }] });
			pi.on(boundary, () => {
				if (requests !== 1) return;
				return { entries: [{ type: "compaction" as const, summary: "Earlier context", firstKeptEntryId: null }], continue: true };
			});
		}]);
	}
});

test("reports source session and entry IDs for ranked matches", async () => {
	const dir = await mkdtemp(join(tmpdir(), "recall-"));
	const file = join(dir, "current.jsonl");
	await sessionFile(file, "current-session", []);
	const result = await invoke({
		file,
		header: { type: "session", id: "current-session", timestamp: "2025-01-01T00:00:00.000Z" },
		entries: [message("entry-1", "sqlite fts is useful", "2025-01-01T00:00:00.000Z")],
	});
	assert.match(resultText(result), /current-session#entry-1/);
});

test("supports noncontiguous terms and prefers a literal phrase over relevance and recency", async () => {
	const entries = [
		message("old-relevant", "alpha appears here and gamma appears later", "2020-01-01T00:00:00.000Z"),
		message("recent-partial", "alphabet soup", "2025-01-01T00:00:00.000Z"),
		message("old-phrase", "alpha gamma", "2020-01-02T00:00:00.000Z"),
	];
	const result = await invoke({ entries, query: "alpha gamma" });
	const text = resultText(result);
	assert.ok(text.indexOf("old-phrase") < text.indexOf("old-relevant"));
	const partial = resultText(await invoke({ entries, query: "alpha" }));
	assert.ok(partial.indexOf("old-relevant") < partial.indexOf("recent-partial"), partial);
});

test("prefers an exact token over a recent porter-stemmed match", async () => {
	const result = await invoke({
		entries: [
			message("stemmed", "deploying the service", "2025-01-01T00:00:00.000Z"),
			message("exact", "deploy the service", "2020-01-01T00:00:00.000Z"),
		],
		query: "deploy",
	});
	assert.ok(resultText(result).indexOf("exact") < resultText(result).indexOf("stemmed"));
});

test("retains literal path, punctuation, and partial identifier matching", async () => {
	const entries = [
		message("path", "Changed /src/foo_bar.ts today", "2025-01-01T00:00:00.000Z"),
		message("partial", "prefix foo_bar_suffix", "2025-01-01T00:00:00.000Z"),
		message("punctuation", "error code ERR!", "2025-01-01T00:00:00.000Z"),
	];
	assert.match(resultText(await invoke({ entries, query: "/src/foo_bar.ts" })), /path/);
	assert.match(resultText(await invoke({ entries, query: "foo_bar" })), /partial/);
	assert.match(resultText(await invoke({ entries, query: "ERR!" })), /punctuation/);
});

test("searches all current entries and readable ancestors, including an unavailable current file", async () => {
	const dir = await mkdtemp(join(tmpdir(), "recall-"));
	const parent = join(dir, "parent.jsonl");
	await sessionFile(parent, "parent-session", [message("parent-entry", "ancestor-only-value", "2020-01-01T00:00:00.000Z")], parent);
	const result = await invoke({
		file: join(dir, "not-yet-flushed.jsonl"),
		header: { type: "session", id: "live-session", parentSession: parent },
		entries: [message("live-entry", "current value", "2025-01-01T00:00:00.000Z")],
		query: "ancestor-only-value",
	});
	assert.match(resultText(result), /parent-session#parent-entry/);
	assert.equal(result.details.sessions, 2);
});

test("does not search an unrelated session beside the current file", async () => {
	const dir = await mkdtemp(join(tmpdir(), "recall-"));
	const file = join(dir, "current.jsonl");
	await sessionFile(file, "current-session", []);
	await sessionFile(join(dir, "unrelated.jsonl"), "unrelated-session", [message("secret", "unrelated_probe", "2025-01-01T00:00:00.000Z")]);
	const result = await invoke({ file, entries: [], query: "unrelated_probe" });
	assert.equal(result.details.matches, 0);
	assert.match(resultText(result), /^No matches in this thread/);
});

test("deduplicates copied entries, preserves ancestor branches, and stops cyclic ancestry", async () => {
	const dir = await mkdtemp(join(tmpdir(), "recall-"));
	const parent = join(dir, "parent.jsonl");
	const root = message("root", "cycle-value", "2020-01-01T00:00:00.000Z");
	const branchA = message("branch-a", "ancestor-alpha", "2025-01-01T00:00:00.000Z", "root");
	const branchB = message("branch-b", "ancestor-beta", "2025-01-01T00:00:00.000Z", "root");
	await sessionFile(parent, "parent-session", [root, branchA, branchB], parent);
	const copiedRoot = { ...root };
	const current = message("current", "live", "2025-01-02T00:00:00.000Z", "root");
	const options = {
		file: join(dir, "current.jsonl"),
		header: { type: "session", id: "current-session", parentSession: parent },
		entries: [copiedRoot, current],
	};
	const result = await invoke({ ...options, query: "cycle-value" });
	assert.equal(result.details.matches, 1);
	assert.equal((await invoke({ ...options, query: "alpha" })).details.matches, 1);
	assert.equal((await invoke({ ...options, query: "beta" })).details.matches, 1);
});

test("includes compaction and tool text while skipping thinking and tool calls", async () => {
	const entries = [
		{ type: "compaction", id: "compact", parentId: null, timestamp: "2020-01-01T00:00:00.000Z", summary: "compaction-retained" },
		message("thinking", "", "2020-01-01T00:00:00.000Z", null, [{ type: "thinking", thinking: "private-thinking" }]),
		{ type: "message", id: "tool", timestamp: "2020-01-01T00:00:00.000Z", message: { role: "toolResult", toolName: "bash", content: [{ type: "text", text: "tool-retained" }] } },
		message("call", "", "2020-01-01T00:00:00.000Z", null, [{ type: "toolCall", name: "ignored-call" }]),
	];
	assert.match(resultText(await invoke({ entries, query: "compaction-retained" })), /compact/);
	assert.match(resultText(await invoke({ entries, query: "tool-retained" })), /tool:bash/);
	assert.equal((await invoke({ entries, query: "private-thinking" })).details.matches, 0);
	assert.equal((await invoke({ entries, query: "ignored-call" })).details.matches, 0);
});

test("reports one shown match and one omitted notice for a limit of one", async () => {
	const entries = [
		message("first", "exactly-one-omitted", "2025-01-01T00:00:00.000Z"),
		message("second", "exactly-one-omitted", "2025-01-02T00:00:00.000Z"),
	];
	const result = await invoke({ entries, query: "exactly-one-omitted", limit: 1 });
	assert.equal(result.details.matches, 2);
	assert.equal(result.details.shown, 1);
	assert.match(resultText(result), /\(1 further match not shown; narrow the query\)/);
});

test("clamps positive fractional limits to one match", async () => {
	const entries = [
		message("first", "fractional-limit", "2025-01-01T00:00:00.000Z"),
		message("second", "fractional-limit", "2025-01-02T00:00:00.000Z"),
	];
	const result = await invoke({ entries, query: "fractional-limit", limit: 0.5 });
	assert.equal(result.details.matches, 2);
	assert.equal(result.details.shown, 1);
});

test("keeps the complete rendered result within the cap and reports shown counts", async () => {
	const entries = Array.from({ length: 20 }, (_, index) => message(`entry-${index}`, `cap-term ${"x".repeat(800)}`, "2025-01-01T00:00:00.000Z"));
	const result = await invoke({ entries, query: "cap-term", limit: 20 });
	assert.ok(resultText(result).length <= 6000);
	assert.equal(result.details.matches, 20);
	assert.ok(result.details.shown < result.details.matches);
	assert.equal((resultText(result).match(/^\[/gm) ?? []).length, result.details.shown);
	assert.ok(resultText(result).endsWith(`(${20 - result.details.shown} further matches not shown; narrow the query)`));
});

test("uses the default limit for empty-or-invalid limits and rejects an empty query", async () => {
	const entries = Array.from({ length: 12 }, (_, index) => message(`entry-${index}`, "limit-term", "2025-01-01T00:00:00.000Z"));
	const result = await invoke({ entries, query: "limit-term", limit: 0 });
	assert.equal(result.details.matches, 12);
	assert.equal(result.details.shown, 10);
	const invalid = await invoke({ entries, query: "" });
	assert.match(resultText(invalid), /non-empty query/);
});
