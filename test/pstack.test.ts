import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import pstack from "../extensions/pstack/index.ts";

let root: string;
let oldAgentDir: string | undefined;
before(() => {
	root = mkdtempSync(join(tmpdir(), "pstack-test-"));
	oldAgentDir = process.env.PI_CODING_AGENT_DIR;
	process.env.PI_CODING_AGENT_DIR = root;
});
beforeEach(() => rmSync(join(root, "configs"), { recursive: true, force: true }));
after(() => {
	if (oldAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = oldAgentDir;
	rmSync(root, { recursive: true, force: true });
});

// Registration is a host fixture; branch storage and file I/O use the real SDK and filesystem.
function host(options: { manager?: SessionManager; hasUI?: boolean } = {}) {
	let manager = options.manager ?? SessionManager.inMemory(root);
	const commands = new Map<string, any>();
	const events = new Map<string, any>();
	const registered = new Map<string, any>();
	const flags: string[] = [];
	const messages: string[] = [];
	const statuses: (string | undefined)[] = [];
	const ctx = {
		get sessionManager() { return manager; }, cwd: root, mode: options.hasUI ? "tui" : "json", hasUI: options.hasUI ?? false,
		ui: { notify: (text: string) => messages.push(text), setStatus: (_key: string, text?: string) => statuses.push(text) },
		abort: () => { throw new Error("Checklist commands must not cancel agents."); },
	};
	pstack({
		registerFlag: (name: string) => flags.push(name),
		registerCommand: (name: string, command: any) => commands.set(name, command),
		registerTool: (tool: any) => registered.set(tool.name, tool),
		on: (event: string, handler: any) => events.set(event, handler),
		appendEntry: (type: string, data: unknown) => manager.appendCustomEntry(type, data),
		sendMessage: (message: any) => messages.push(message.content),
	} as any);
	return {
		get manager() { return manager; }, commands, flags, messages, statuses,
		setManager: (value: SessionManager) => { manager = value; },
		async command(args = "") { await commands.get("pstack").handler(args, ctx); return messages.at(-1)!; },
		async tasks(params: unknown = { action: "read" }) { return registered.get("pstack_tasks").execute("id", params, undefined, undefined, ctx); },
		async event(name: string) { return events.get(name)({}, ctx); },
		async start(sections: Record<string, string> = {}, customPrompt = "", appendSystemPrompt = "Keep appended prompt") {
			const event = { prompt: "Work", systemPrompt: customPrompt, systemPromptOptions: { customPrompt, sections, appendSystemPrompt, promptGuidelines: ["Keep guideline"] } };
			assert.equal(await events.get("before_agent_start")(event, ctx), undefined);
			return event.systemPromptOptions;
		},
	};
}

// Each case protects the checklist, skill-discovery, or retired-controller migration boundary.
test("exposes only the checklist command, ignores legacy mode state and config, and adds no workflow prompt", async () => {
	for (const raw of ['{"defaultLevel":"full","models":{"architect runners":["inherit-parent"]}}', "{broken"]) {
		mkdirSync(join(root, "configs"), { recursive: true });
		writeFileSync(join(root, "configs/pstack.json"), raw);
		const h = host();
		h.manager.appendCustomEntry("pstack.level", { choice: "full" });
		h.manager.appendCustomEntry("pstack.assignment", { level: "focused" });
		const leaf = h.manager.getLeafId();
		assert.deepEqual([...h.commands.keys()], ["pstack"]);
		assert.deepEqual(h.flags, []);
		await h.event("session_start");
		assert.deepEqual(h.messages, []);
		assert.match(await h.command(), /No tasks on this branch/);
		const options = await h.start({ safety: "Keep safety" });
		assert.deepEqual(options.sections, { safety: "Keep safety" });
		assert.equal(options.appendSystemPrompt, "Keep appended prompt");
		assert.deepEqual(options.promptGuidelines, ["Keep guideline"]);
		assert.equal(h.manager.getLeafId(), leaf);
		assert.equal(readFileSync(join(root, "configs/pstack.json"), "utf8"), raw);
		assert.deepEqual(readdirSync(join(root, "configs")), ["pstack.json"]);
	}
});

test("removes only retired mode policy from resumed and inherited prompts", async () => {
	const h = host();
	const legacy = "<pstack>\npstack-level: full\npstack-role: parent\nOld controller policy\n</pstack>";
	const unrelated = "<pstack>\nUser-owned instructions\n</pstack>";
	for (const section of ["pstack-level: full\nOld policy", "pstack-level: ERROR\nOld error"]) {
		const options = await h.start({ pstack: section, safety: "Preserved" }, `Repository rules\n${legacy}\n${unrelated}\n<sub_agent_context>Assigned task</sub_agent_context>`, `Append safety\n${legacy}`);
		assert.deepEqual(options.sections, { safety: "Preserved" });
		assert.doesNotMatch(options.customPrompt, /pstack-level|Old controller policy/);
		assert.match(options.customPrompt, /Repository rules/);
		assert.ok(options.customPrompt.includes(unrelated));
		assert.match(options.customPrompt, /<sub_agent_context>/);
		assert.equal(options.appendSystemPrompt.trim(), "Append safety");
	}
	assert.deepEqual((await h.start({ pstack: "User-owned section" })).sections, { pstack: "User-owned section" });
	for (const prior of ["<pstack>\n</pstack>", "<pstack>\nUser-owned inline closing tag</pstack>", unrelated]) {
		const before = `${prior}\nKEEP SAFETY RULES\n`;
		const prompt = `${before}${legacy}\nKEEP TAIL`;
		const options = await h.start({}, prompt, prompt);
		assert.equal(options.customPrompt, `${before}\nKEEP TAIL`);
		assert.equal(options.appendSystemPrompt, `${before}\nKEEP TAIL`);
	}
});

test("retired mode subcommands cannot mutate session state or checklist", async () => {
	const h = host();
	const tasks = [{ title: "Keep work", status: "pending" }];
	await h.tasks({ action: "replace", tasks });
	const leaf = h.manager.getLeafId();
	for (const args of ["full", "focused", "off", "status", "reset", "save full", "tasks"]) {
		assert.match(await h.command(args), /Usage: \/pstack \(checklist\).*\/skill:pstack-poteto-mode/);
		assert.equal(h.manager.getLeafId(), leaf);
		assert.deepEqual((await h.tasks()).structuredContent.tasks, tasks);
	}
	assert.equal(readdirSync(root).includes("configs"), false);
});

test("bare pstack displays the entire checklist in UI and headless modes and clears an empty footer", async () => {
	for (const hasUI of [true, false]) {
		const h = host({ hasUI });
		await h.event("session_start");
		assert.match(await h.command(), /No tasks on this branch/);
		const tasks = [{ title: "Ground", status: "done" }, { title: "Build", status: "in-progress" }, { title: "Extra", status: "skipped", reason: "Not approved" }, ...Array.from({ length: 61 }, (_, index) => ({ title: `Remaining ${index}`, status: "pending" }))];
		await h.tasks({ action: "replace", tasks });
		const leaf = h.manager.getLeafId();
		const text = await h.command("   ");
		assert.match(text, /1\/64 done, 1 skipped, 1 active/);
		assert.match(text, /1\. \[done\] Ground/);
		assert.match(text, /3\. \[skipped\] Extra — Reason: Not approved/);
		assert.match(text, /64\. \[pending\] Remaining 60/);
		assert.equal(h.manager.getLeafId(), leaf);
		if (hasUI) assert.match(h.statuses.at(-1)!, /^tasks: \/pstack.*1 active/);
		await h.tasks({ action: "replace", tasks: [] });
		if (hasUI) assert.equal(h.statuses.at(-1), undefined);
	}
});

test("checklist follows active branches, disk reload, fork, and fresh sessions without mode state", async () => {
	const manager = SessionManager.create(root, join(root, "sessions"));
	const initial = manager.appendMessage({ role: "user", content: "Begin", timestamp: 1 });
	const h = host({ manager });
	await h.tasks({ action: "replace", tasks: [{ title: "Branch A", status: "in-progress" }] });
	const branchA = manager.getLeafId()!;
	manager.branch(initial);
	assert.deepEqual((await h.tasks()).structuredContent.tasks, []);
	await h.tasks({ action: "replace", tasks: [{ title: "Branch B", status: "skipped", reason: "User deferred" }] });
	const branchB = manager.getLeafId()!;
	manager.branch(branchA);
	assert.deepEqual((await h.tasks()).structuredContent.tasks, [{ title: "Branch A", status: "in-progress" }]);
	assert.match(await h.command(), /\[in-progress\] Branch A/);
	manager.branch(branchB);
	const reload = host({ manager: SessionManager.open(manager.getSessionFile()!) });
	await reload.event("session_start");
	assert.deepEqual((await reload.tasks()).structuredContent.tasks, [{ title: "Branch B", status: "skipped", reason: "User deferred" }]);
	const forkPath = manager.createBranchedSession(branchA)!;
	reload.setManager(SessionManager.open(forkPath));
	assert.equal((await reload.tasks()).structuredContent.tasks[0].title, "Branch A");
	reload.setManager(SessionManager.inMemory(root));
	await reload.event("session_start");
	assert.deepEqual((await reload.tasks()).structuredContent.tasks, []);
});

test("corrupt latest checklist is reported instead of restoring stale tasks", async () => {
	const h = host({ hasUI: true });
	await h.tasks({ action: "replace", tasks: [{ title: "Initial", status: "done" }] });
	h.manager.appendCustomEntry("pstack.tasks", [{ title: "Invalid", status: "skipped" }]);
	await assert.rejects(h.tasks(), /requires a reason/);
	assert.match(await h.command(), /requires a reason/);
	assert.equal(h.statuses.at(-1), "pstack checklist ERROR");
	await h.tasks({ action: "replace", tasks: [] });
	assert.deepEqual((await h.tasks()).structuredContent.tasks, []);
});

test("checklist replacement protects rationale, single active task, size bounds, and input shape", async () => {
	const h = host();
	const kept = [{ title: "Ground", status: "done" }, { title: "Build", status: "in-progress" }, { title: "Extra", status: "skipped", reason: "Not approved" }];
	await h.tasks({ action: "replace", tasks: kept });
	const invalid = [
		{ action: "replace", tasks: [{ title: "Skip", status: "skipped" }] },
		{ action: "replace", tasks: [{ title: "Skip", status: "skipped", reason: "   " }] },
		{ action: "replace", tasks: [{ title: "A", status: "in-progress" }, { title: "B", status: "in-progress" }] },
		{ action: "replace", tasks: [{ title: " ", status: "pending" }] },
		{ action: "replace", tasks: [{ title: "x".repeat(301), status: "pending" }] },
		{ action: "replace", tasks: [{ title: "x", status: "done", reason: "x".repeat(501) }] },
		{ action: "replace", tasks: [{ title: "line\nchange", status: "pending" }] },
		{ action: "replace", tasks: [{ title: "x", status: "pending", reason: "escape\u001b" }] },
		{ action: "replace", tasks: [{ title: "x", status: "unknown" }] },
		{ action: "replace", tasks: Array.from({ length: 65 }, () => ({ title: "x", status: "pending" })) },
		{ action: "replace", tasks: null }, { action: "replace" },
		{ action: "read", tasks: [] }, { action: "set-level", level: "off" },
		{ action: "replace", tasks: [], level: "off" },
		{ action: "replace", tasks: [{ title: "x", status: "done", level: "off" }] },
	];
	for (const params of invalid) {
		await assert.rejects(h.tasks(params), /pstack_tasks|Task|At most/);
		assert.deepEqual((await h.tasks()).structuredContent.tasks, kept);
	}
	const maximum = Array.from({ length: 64 }, (_, index) => ({ title: `${index}`.padEnd(300, "界"), status: "skipped", reason: "理".repeat(500) }));
	const result = await h.tasks({ action: "replace", tasks: maximum });
	assert.deepEqual(result.structuredContent.tasks, maximum);
	assert.equal(result.content[0].text.split("\n").length, 65);
	assert.ok(result.content[0].text.length < 54000);
	assert.ok(result.content[0].text.endsWith(maximum[63].reason));
	assert.deepEqual((await h.tasks()).structuredContent.tasks, maximum);
});

test("actual Pi host discovers workflow skills without activation and handles the checklist without a model", async () => {
	for (const packagePath of ["../", "../extensions/pstack/index.ts"]) {
		const settingsManager = SettingsManager.inMemory({ packages: [] });
		const resources = new DefaultResourceLoader({
			cwd: root, agentDir: root, settingsManager, noSkills: true, noContextFiles: true,
			additionalExtensionPaths: [new URL(packagePath, import.meta.url).pathname],
			additionalSkillPaths: [new URL("../skills/pstack", import.meta.url).pathname],
		});
		await resources.reload();
		const manager = SessionManager.inMemory(root);
		manager.appendCustomEntry("pstack.level", { choice: "full" });
		const { session } = await createAgentSession({ cwd: root, agentDir: root, settingsManager, resourceLoader: resources, sessionManager: manager });
		try {
			await session.bindExtensions({ mode: "json" });
			const runner = session.extensionRunner!;
			assert.deepEqual(runner.getRegisteredCommands().filter((command) => ["pstack", "poteto-mode"].includes(command.name)).map((command) => command.name), ["pstack"]);
			assert.equal(runner.getFlags().has("pstack-level"), false);
			const { skills, diagnostics } = resources.getSkills();
			assert.equal(diagnostics.length, 0, JSON.stringify(diagnostics));
			assert.equal(skills.filter((skill) => skill.name.startsWith("pstack-")).length, 49);
			for (const name of ["pstack", "pstack-poteto-mode", "pstack-architect", "pstack-correct"]) assert.ok(skills.some((skill) => skill.name === name));
			await session.prompt("/pstack");
			assert.ok(manager.getBranch().some((entry) => entry.type === "custom_message" && String(entry.content).includes("No tasks on this branch")));
			const result = await runner.emitBeforeAgentStart("Check", undefined, { cwd: root, appendSystemPrompt: "Existing append", sections: { pstack: "pstack-level: full\nOld controller", safety: "Existing safety" } });
			assert.deepEqual(result.systemPromptOptions.sections, { safety: "Existing safety" });
			assert.equal(result.systemPromptOptions.appendSystemPrompt, "Existing append");
			const tool = runner.getToolDefinition("pstack_tasks")!;
			const ctx = runner.createToolContext("test", undefined);
			const tasks = [{ title: "Host checklist", status: "in-progress" }];
			await tool.execute("test", { action: "replace", tasks }, undefined, undefined, ctx);
			assert.deepEqual((await tool.execute("read", { action: "read" }, undefined, undefined, ctx)).structuredContent, { tasks });
			await session.prompt("/pstack");
			assert.ok(manager.getBranch().some((entry) => entry.type === "custom_message" && String(entry.content).includes("[in-progress] Host checklist")));
		} finally { session.dispose(); }
	}
});

test("real CLI prints the checklist and leaves JSON stdout parseable without mode flags", () => {
	const run = (mode: string, command = "/pstack") => spawnSync(process.execPath, [
		"node_modules/@earendil-works/pi-coding-agent/dist/cli.js", "--offline", "--no-extensions", "--no-skills", "--no-context-files", "--no-session",
		"-e", "./extensions/pstack/index.ts", "--mode", mode, command,
	], { cwd: new URL("../", import.meta.url), encoding: "utf8", env: { ...process.env, PI_CODING_AGENT_DIR: root } });
	const text = run("text");
	assert.equal(text.status, 0, text.stderr);
	assert.match(text.stderr, /No tasks on this branch/);
	assert.doesNotMatch(text.stderr, /effective level|Saved default/);
	const retired = run("text", "/pstack full");
	assert.equal(retired.status, 0, retired.stderr);
	assert.match(retired.stderr, /Usage: \/pstack \(checklist\)/);
	const json = run("json");
	assert.equal(json.status, 0, json.stderr);
	const entries = json.stdout.trim().split("\n").map((line) => JSON.parse(line));
	assert.ok(entries.some((entry) => entry.type === "message_end" && entry.message?.role === "custom" && String(entry.message.content).includes("No tasks on this branch")));
});
