import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before, beforeEach } from "node:test";
import { createAgentSession, DefaultResourceLoader, getAgentDir, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
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

function config(raw: string) {
	mkdirSync(join(root, "configs"), { recursive: true });
	writeFileSync(join(root, "configs", "pstack.json"), raw);
}

const agentTool = (types = ["general-purpose"])  => ({
	name: "Agent", description: "Launch an agent", exposure: "direct", parameters: Type.Object({
		subagent_type: Type.String({ description: `Available types: ${types.join(", ")}. Custom agents are also available.` }),
	}),
});

// Registration is a host fixture; branch storage and file I/O use the real SDK and filesystem.
function host(options: { manager?: SessionManager; flag?: unknown; tools?: any[]; hasUI?: boolean; prompt?: string } = {}) {
	let manager = options.manager ?? SessionManager.inMemory(root);
	let flag = options.flag;
	let prompt = options.prompt ?? "";
	const tools = options.tools ?? [agentTool()];
	const commands = new Map<string, any>();
	const events = new Map<string, any>();
	const registered = new Map<string, any>();
	const messages: string[] = [];
	const statuses: string[] = [];
	const ctx = {
		get sessionManager() { return manager; }, cwd: root, mode: options.hasUI ? "tui" : "json", hasUI: options.hasUI ?? false,
		getSystemPrompt: () => prompt,
		ui: { notify: (text: string) => messages.push(text), setStatus: (_key: string, text: string) => statuses.push(text) },
		abort: () => { throw new Error("Level commands must not cancel agents."); },
	};
	pstack({
		registerFlag: () => {}, getFlag: () => flag,
		registerCommand: (name: string, command: any) => commands.set(name, command),
		registerTool: (tool: any) => registered.set(tool.name, tool),
		on: (event: string, handler: any) => events.set(event, handler),
		appendEntry: (type: string, data: unknown) => manager.appendCustomEntry(type, data),
		getAllTools: () => tools, getActiveTools: () => tools.filter((tool) => tool.exposure !== "hidden").map((tool) => tool.name),
		sendMessage: (message: any) => messages.push(message.content),
	} as any);
	return {
		get manager() { return manager; }, messages, statuses,
		setManager: (value: SessionManager) => { manager = value; },
		setFlag: (value: unknown) => { flag = value; },
		setPrompt: (value: string) => { prompt = value; },
		async command(args = "status") { await commands.get("pstack").handler(args, ctx); return messages.at(-1)!; },
		async poteto(args = "") { await commands.get("poteto-mode").handler(args, ctx); return messages.at(-1)!; },
		async tasks(params: unknown = { action: "read" }) { return registered.get("pstack_tasks").execute("id", params, undefined, undefined, ctx); },
		async event(name: string, payload: any = {}) { return events.get(name)(payload, ctx); },
		async start(sections: Record<string, string> = {}, brief = "") {
			const event = { prompt: brief, systemPrompt: prompt, systemPromptOptions: { customPrompt: prompt, sections, appendSystemPrompt: "Keep appended prompt", promptGuidelines: ["Keep guideline"] } };
			const result = await events.get("before_agent_start")(event, ctx);
			assert.equal(result, undefined, "extension must not replace the full prompt");
			return event.systemPromptOptions;
		},
	};
}

// Authoring gate: each case protects a new command/config/session/prompt/tool contract.
// Existing extensions do not cover these failures. No production test-only exports or hooks are used.
test("defaults to off, enables full with poteto-mode, and scopes prompt policy without writing user config", async () => {
	assert.equal(getAgentDir(), root);
	const h = host();
	const status = await h.command();
	assert.match(status, /effective level: off; source: built-in default/);
	assert.match(status, /Saved default: off/);
	assert.match(status, /Full delegation available/);
	assert.equal(readdirSync(root).includes("configs"), false);
	assert.deepEqual((await h.start({ unrelated: "other section", pstack: "stale" })).sections, { unrelated: "other section" });
	assert.match(await h.poteto(), /effective level: full; source: session/);
	assert.equal(readdirSync(root).includes("configs"), false);
	const options = await h.start({ unrelated: "other section" });
	assert.equal(options.sections.unrelated, "other section");
	assert.match(options.sections.pstack, /^pstack-level: full/m);
	assert.match(options.sections.pstack, /skills\/pstack\/SKILL\.md/);
	assert.match(options.sections.pstack, /Ordinary questions/);
	assert.equal(options.appendSystemPrompt, "Keep appended prompt");
	assert.deepEqual(options.promptGuidelines, ["Keep guideline"]);
	const ui = host({ hasUI: true });
	await ui.command("focused");
	await ui.tasks({ action: "replace", tasks: [{ title: "Implement", status: "in-progress" }] });
	assert.match(ui.statuses.at(-1)!, /pstack focused.*tasks: \/pstack.*1 active/);
});

test("models-only config stays off and poteto-mode overrides CLI while preserving saved preferences and tasks", async () => {
	const raw = '{"models":{"feature, refactoring":"inherit-parent"}}\n';
	config(raw);
	assert.match(await host().command(), /effective level: off; source: saved default/);
	assert.equal((await host().start()).sections.pstack, undefined);
	const h = host({ flag: "off", hasUI: true });
	const tasks = [{ title: "Keep assignment", status: "in-progress" }];
	await h.tasks({ action: "replace", tasks });
	assert.match(await h.poteto("focused"), /effective level: focused; source: session/);
	assert.match(h.statuses.at(-1)!, /pstack focused.*1 active/);
	for (const invalid of ["fast", "full extra", "status", "save off"]) {
		assert.match(await h.poteto(invalid), /Usage: \/poteto-mode/);
		assert.match(await h.command(), /effective level: focused/);
	}
	assert.match(await h.poteto("off"), /effective level: off/);
	assert.deepEqual((await h.tasks()).structuredContent.tasks, tasks);
	assert.match(await h.poteto(), /effective level: full/);
	assert.deepEqual((await h.tasks()).structuredContent.tasks, tasks);
	assert.equal(readFileSync(join(root, "configs/pstack.json"), "utf8"), raw);
	assert.deepEqual(readdirSync(join(root, "configs")), ["pstack.json"]);
	assert.match(await host().command(), /effective level: off/);
	config('{"defaultLevel":"focused"}');
	assert.match(await host().command(), /effective level: focused/);
	config('{"defaultLevel":"full"}');
	assert.match(await host().command(), /effective level: full/);
});

test("session commands override CLI, save preserves unrelated keys with exact backup, and reset tracks saved default ignoring CLI", async () => {
	const original = '{ "defaultLevel": "focused", "theme": { "color": "blue" }, "other": [1, 2] }\n';
	config(original);
	const h = host({ flag: "off" });
	assert.match(await h.command(), /effective level: off; source: CLI/);
	assert.match(await h.command("full"), /effective level: full; source: session/);
	await h.command("save focused");
	assert.deepEqual(JSON.parse(readFileSync(join(root, "configs/pstack.json"), "utf8")), { defaultLevel: "focused", theme: { color: "blue" }, other: [1, 2] });
	const backups = readdirSync(join(root, "configs")).filter((name) => name.startsWith("pstack.json.backup-"));
	assert.equal(backups.length, 1);
	assert.equal(readFileSync(join(root, "configs", backups[0]), "utf8"), original);
	assert.match(await h.command(), /effective level: full; source: session/);
	assert.match(await h.command("reset"), /effective level: focused; source: saved default \(reset; CLI ignored\)/);
	await h.command("save off");
	assert.match(await h.command(), /effective level: off; source: saved default/);
	assert.match(await host().command(), /effective level: off; source: saved default/);
});

test("explicit save creates only dedicated user config and does not change current CLI or session choice", async () => {
	const h = host({ flag: "focused" });
	await h.command("save off");
	assert.deepEqual(JSON.parse(readFileSync(join(root, "configs/pstack.json"), "utf8")), { defaultLevel: "off" });
	assert.deepEqual(readdirSync(join(root, "configs")), ["pstack.json"]);
	assert.match(await h.command(), /effective level: focused; source: CLI/);
	assert.match(await host().command(), /effective level: off; source: saved default/);
});

test("malformed or invalid config fails honestly and remains untouched; explicit session off bypasses it without repairing it", async () => {
	for (const raw of ["{broken", "[]", '{"defaultLevel":"fast"}', '{"defaultLevel":null}']) {
		config(raw);
		const h = host();
		await h.event("session_start");
		assert.match(h.messages.at(-1)!, /pstack ERROR/);
		assert.match(await h.command(), /effective level: ERROR/);
		assert.match((await h.start()).sections.pstack, /level is unresolved/);
		assert.match(await h.command("save focused"), /pstack ERROR/);
		assert.equal(readFileSync(join(root, "configs/pstack.json"), "utf8"), raw);
		assert.deepEqual(readdirSync(join(root, "configs")), ["pstack.json"]);
		await h.poteto();
		assert.match(await h.command(), /effective level: full; source: session/);
		await h.command("off");
		assert.match(await h.command(), /effective level: off; source: session/);
		assert.match(await h.command(), /ERROR: Invalid/);
		const options = await h.start({ pstack: "old workflow", keep: "retained" });
		assert.deepEqual(options.sections, { keep: "retained" });
		assert.match(await h.command("reset"), /pstack ERROR/);
		assert.match(await h.command(), /effective level: off; source: session/);
	}
});

test("CLI values are validated and reported without silent full; a later session choice takes precedence", async () => {
	config('{"defaultLevel":"focused"}');
	for (const level of ["full", "focused", "off"]) {
		const h = host({ flag: level });
		assert.match(await h.command(), new RegExp(`effective level: ${level}; source: CLI`));
	}
	for (const flag of ["invalid", "", true]) {
		const h = host({ flag });
		await h.event("session_start");
		assert.match(h.messages.at(-1)!, /Invalid --pstack-level/);
		assert.match(await h.command(), /effective level: ERROR; source: CLI/);
		assert.match((await h.start()).sections.pstack, /level is unresolved/);
		assert.match(await h.command("off"), /effective level: off; source: session/);
		assert.match(await h.command("reset"), /effective level: focused; source: saved default/);
	}
});

test("off removes only workflow section and keeps checklist available; invalid commands cannot change state", async () => {
	const h = host();
	await h.tasks({ action: "replace", tasks: [{ title: "Ship", status: "pending" }] });
	await h.command("off");
	for (const command of ["fast", "save", "save fast", "full extra", "reset extra", "status extra"]) assert.match(await h.command(command), /Usage:/);
	const options = await h.start({ pstack: "previous", safety: "Keep safety", other: "Keep other" });
	assert.deepEqual(options.sections, { safety: "Keep safety", other: "Keep other" });
	assert.deepEqual((await h.tasks()).structuredContent.tasks, [{ title: "Ship", status: "pending" }]);
	assert.match(await h.command(), /effective level: off; source: session/);
});

test("bare pstack displays the complete active checklist in UI and headless modes without changing state", async () => {
	for (const hasUI of [true, false]) {
		const h = host({ hasUI });
		assert.match(await h.command(""), /No tasks on this branch/);
		const tasks = [{ title: "Ground", status: "done" }, { title: "Build", status: "in-progress" }, { title: "Extra", status: "skipped", reason: "Not approved" }, ...Array.from({ length: 61 }, (_, index) => ({ title: `Remaining ${index}`, status: "pending" }))];
		await h.tasks({ action: "replace", tasks });
		const leaf = h.manager.getLeafId();
		const text = await h.command("   ");
		assert.match(text, /1\/64 done, 1 skipped, 1 active/);
		assert.match(text, /1\. \[done\] Ground/);
		assert.match(text, /3\. \[skipped\] Extra — Reason: Not approved/);
		assert.match(text, /64\. \[pending\] Remaining 60/);
		assert.equal(h.manager.getLeafId(), leaf);
		assert.deepEqual((await h.tasks()).structuredContent.tasks, tasks);
		assert.match(await h.command("tasks"), /Usage:/);
		assert.match(await h.command(), /effective level: off/);
	}
});

test("level and checklist follow real active branches, disk reload, fork, and fresh sessions", async () => {
	const manager = SessionManager.create(root, join(root, "sessions"));
	const initial = manager.appendMessage({ role: "user", content: "Begin", timestamp: 1 });
	const h = host({ manager });
	await h.command("focused");
	await h.tasks({ action: "replace", tasks: [{ title: "Branch A", status: "in-progress" }] });
	const branchA = manager.getLeafId()!;
	manager.branch(initial);
	assert.match(await h.command(), /effective level: off/);
	assert.deepEqual((await h.tasks()).structuredContent.tasks, []);
	assert.match(await h.command(""), /No tasks on this branch/);
	await h.command("off");
	await h.tasks({ action: "replace", tasks: [{ title: "Branch B", status: "skipped", reason: "User deferred" }] });
	const branchB = manager.getLeafId()!;
	manager.branch(branchA);
	// State must be correct without relying on a session_tree notification.
	assert.match(await h.command(), /effective level: focused/);
	assert.deepEqual((await h.tasks()).structuredContent.tasks, [{ title: "Branch A", status: "in-progress" }]);
	assert.match(await h.command(""), /\[in-progress\] Branch A/);
	await h.event("session_tree");
	assert.match((await h.start()).sections.pstack, /pstack-level: focused/);
	manager.branch(branchB);
	const reopened = SessionManager.open(manager.getSessionFile()!);
	const reload = host({ manager: reopened });
	await reload.event("session_start", { reason: "reload" });
	assert.match(await reload.command(), /effective level: off/);
	assert.deepEqual((await reload.tasks()).structuredContent.tasks, [{ title: "Branch B", status: "skipped", reason: "User deferred" }]);
	const forkPath = manager.createBranchedSession(branchA)!;
	reload.setManager(SessionManager.open(forkPath));
	assert.match(await reload.command(), /effective level: focused/);
	assert.equal((await reload.tasks()).structuredContent.tasks[0].title, "Branch A");
	reload.setManager(SessionManager.inMemory(root));
	await reload.event("session_start", { reason: "new" });
	assert.match(await reload.command(), /effective level: off/);
	assert.deepEqual((await reload.tasks()).structuredContent.tasks, []);
});

test("corrupt latest session choice or checklist is reported rather than restoring defaults or stale state", async () => {
	const h = host();
	await h.command("focused");
	h.manager.appendCustomEntry("pstack.level", { choice: "fast" });
	assert.match(await h.command(), /effective level: ERROR/);
	assert.match((await h.start()).sections.pstack, /Invalid pstack session choice/);
	await h.command("full");
	await h.tasks({ action: "replace", tasks: [{ title: "Initial", status: "done" }] });
	h.manager.appendCustomEntry("pstack.tasks", [{ title: "Invalid", status: "skipped" }]);
	await assert.rejects(h.tasks(), /requires a reason/);
	await h.tasks({ action: "replace", tasks: [] });
	assert.deepEqual((await h.tasks()).structuredContent.tasks, []);
});

test("full works with general-purpose alone and reports unavailable delegation without requiring profile roles", async () => {
	for (const tool of [
		agentTool(["Explore"]),
		agentTool(),
		{ ...agentTool(), parameters: Type.Object({ subagent_type: Type.Literal("general-purpose") }) },
		{ ...agentTool(), parameters: Type.Object({ subagent_type: Type.String() }) },
	]) {
		const h = host({ tools: [tool] });
		const status = await h.poteto();
		assert.match(status, /effective level: full/);
		const section = (await h.start()).sections.pstack;
		if (status.includes("Full prerequisites blocked")) {
			assert.match(section, /Enable TintinWeb's general-purpose agent/);
			assert.match(section, /Do not silently switch/);
		} else {
			assert.match(status, /Full delegation available/);
			assert.match(section, /no profile role installation is required/);
		}
	}
	const unavailable = host({ tools: [{ ...agentTool(), exposure: "hidden" }], flag: "full" });
	assert.match(await unavailable.command(), /Agent is unavailable/);
	assert.match(await unavailable.command(), /effective level: full/);
	for (const level of ["focused", "off"]) {
		const standalone = host({ tools: [], flag: level });
		assert.match(await standalone.command(), new RegExp(`effective level: ${level}`));
		const options = await standalone.start();
		if (level === "off") assert.equal(options.sections.pstack, undefined);
		else assert.match(options.sections.pstack, /pstack-role: parent/);
	}
});

test("leaf consumes inherited section or explicit brief level, never global full, and keeps parent gates out of its assignment", async () => {
	config('{"defaultLevel":"full"}');
	const h = host({ tools: [], flag: "full", prompt: "Keep repository rules\n<pstack>\npstack-level: focused\npstack-role: parent\n</pstack>\n<sub_agent_context>Delegated assignment</sub_agent_context>" });
	assert.match(await h.command(), /effective level: focused; source: parent section\/brief/);
	let section = (await h.start()).sections.pstack;
	assert.match(section, /pstack-level: focused/);
	assert.match(section, /pstack-role: leaf/);
	assert.match(section, /Parent owns design, delegation, review, and integration/);
	assert.match(section, /Do not restart Feature/);
	section = (await h.start({ pstack: "pstack-level: focused\npstack-role: parent" }, "pstack-level: full\nImplement assigned file")).sections.pstack;
	assert.match(section, /^pstack-level: full/m);
	assert.match((await h.start()).sections.pstack, /^pstack-level: full/m, "explicit brief survives the next turn without inherited section");
	assert.match(await h.command(), /effective level: full; source: parent brief/);
	const off = await h.start({ safety: "preserved" }, "pstack-level: off");
	assert.deepEqual(off.sections, { safety: "preserved" });
	assert.doesNotMatch(off.customPrompt, /<pstack>|pstack-level: focused|pstack-role: parent/);
	assert.match(off.customPrompt, /Keep repository rules/);
	assert.match(off.customPrompt, /<sub_agent_context>/);
	assert.deepEqual((await h.start()).sections, {}, "inherited off survives later turns without re-enabling full");
	await h.command("focused");
	assert.match((await h.start()).sections.pstack, /^pstack-level: focused/m, "explicit user session commands also work in leaf hosts");
	const unassigned = host({ tools: [], prompt: "<sub_agent_context>Delegated assignment</sub_agent_context>" });
	section = (await unassigned.start()).sections.pstack;
	assert.match(section, /^pstack-level: unassigned/m);
	assert.match(section, /request the parent's level/);
	assert.doesNotMatch(section, /^pstack-level: full/m);
});

test("checklist replacement protects skipped rationale, single active task, size bounds, and level isolation at execute boundary", async () => {
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
	assert.match(await h.command(), /effective level: off/);
	const maximum = Array.from({ length: 64 }, (_, index) => ({ title: `${index}`.padEnd(300, "界"), status: "skipped", reason: "理".repeat(500) }));
	const result = await h.tasks({ action: "replace", tasks: maximum });
	assert.deepEqual(result.structuredContent.tasks, maximum);
	assert.equal(result.content[0].text.split("\n").length, 65);
	assert.ok(result.content[0].text.length < 54000);
	assert.ok(result.content[0].text.endsWith(maximum[63].reason));
	assert.deepEqual((await h.tasks()).structuredContent.tasks, maximum);
	await h.tasks({ action: "replace", tasks: [] });
	assert.deepEqual((await h.tasks()).structuredContent.tasks, []);
});

test("actual Pi host handles commands without model calls and composes structured sections through extension runner", async () => {
	const settingsManager = SettingsManager.inMemory({ packages: [] });
	const resources = new DefaultResourceLoader({
		cwd: root, agentDir: root, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true,
		extensionFactories: [pstack, (pi) => pi.registerTool({ ...agentTool(), label: "Agent", async execute() { throw new Error("No agent launches expected"); } })],
	});
	await resources.reload();
	const manager = SessionManager.inMemory(root);
	const { session } = await createAgentSession({ cwd: root, agentDir: root, settingsManager, resourceLoader: resources, sessionManager: manager });
	try {
		await session.bindExtensions({ mode: "json" });
		await session.prompt("/pstack status");
		assert.ok(manager.getBranch().some((entry) => entry.type === "custom_message" && String(entry.content).includes("effective level: off")));
		await session.prompt("/poteto-mode");
		assert.ok(manager.getBranch().some((entry) => entry.type === "custom_message" && String(entry.content).includes("effective level: full")));
		await session.prompt("/poteto-mode focused");
		assert.ok(manager.getBranch().some((entry) => entry.type === "custom_message" && String(entry.content).includes("effective level: focused")));
		let result = await session.extensionRunner!.emitBeforeAgentStart("Check", undefined, { cwd: root, appendSystemPrompt: "Existing appended prompt", sections: { other: "Existing section" } });
		assert.match(result.systemPromptOptions.sections.pstack, /^pstack-level: focused/m);
		assert.equal(result.systemPromptOptions.sections.other, "Existing section");
		assert.equal(result.systemPromptOptions.appendSystemPrompt, "Existing appended prompt");
		const tool = session.extensionRunner!.getToolDefinition("pstack_tasks")!;
		const ctx = session.extensionRunner!.createToolContext("test", undefined);
		const tasks = [{ title: "Host checklist", status: "in-progress" }];
		await tool.execute("test", { action: "replace", tasks }, undefined, undefined, ctx);
		assert.deepEqual((await tool.execute("read", { action: "read" }, undefined, undefined, ctx)).structuredContent, { tasks });
		await session.prompt("/pstack");
		assert.ok(manager.getBranch().some((entry) => entry.type === "custom_message" && String(entry.content).includes("[in-progress] Host checklist")));
		await session.prompt("/poteto-mode off");
		result = await session.extensionRunner!.emitBeforeAgentStart("Check", undefined, { cwd: root, sections: { pstack: "Old workflow", other: "Existing section" } });
		assert.deepEqual(result.systemPromptOptions.sections, { other: "Existing section" });
	} finally { session.dispose(); }

	const childResources = new DefaultResourceLoader({ cwd: root, agentDir: root, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, extensionFactories: [pstack] });
	await childResources.reload();
	const { session: child } = await createAgentSession({ cwd: root, agentDir: root, settingsManager, resourceLoader: childResources, sessionManager: SessionManager.inMemory(root) });
	try {
		await child.bindExtensions({ mode: "json" });
		const inherited = "Keep repository safety\n<pstack>\npstack-level: full\npstack-role: parent\nParent design gates\n</pstack>\n<sub_agent_context>Leaf assignment</sub_agent_context>";
		for (const level of ["focused", "off"]) {
			const result = await child.extensionRunner!.emitBeforeAgentStart(`pstack-level: ${level}`, undefined, { cwd: root, customPrompt: inherited });
			assert.match(result.systemPromptOptions.customPrompt!, /Keep repository safety/);
			assert.match(result.systemPromptOptions.customPrompt!, /<sub_agent_context>/);
			assert.doesNotMatch(result.systemPromptOptions.customPrompt!, /<pstack>|pstack-level: full|Parent design gates/);
			if (level === "off") assert.equal(result.systemPromptOptions.sections.pstack, undefined);
			else assert.match(result.systemPromptOptions.sections.pstack, /pstack-level: focused/);
		}
	} finally { child.dispose(); }
});

test("real CLI shows headless command status, validates custom flag, and leaves JSON stdout parseable", () => {
	const cwd = new URL("../", import.meta.url);
	const run = (mode: string, level: string) => spawnSync(process.execPath, [
		"node_modules/@earendil-works/pi-coding-agent/dist/cli.js", "--offline", "--no-extensions", "--no-skills", "--no-context-files", "--no-session",
		"-e", "./extensions/pstack/index.ts", "--mode", mode, "--pstack-level", level, "/pstack status",
	], { cwd, encoding: "utf8", env: { ...process.env, PI_CODING_AGENT_DIR: root } });
	const status = run("text", "focused");
	assert.equal(status.status, 0, status.stderr);
	assert.match(status.stderr, /Configured parent choice: focused \(CLI/);
	assert.match(status.stderr, /Agent is unavailable/);
	const invalid = run("text", "fast");
	assert.match(invalid.stderr, /Invalid --pstack-level/);
	assert.doesNotMatch(invalid.stderr, /Configured parent choice: full/);
	const json = run("json", "off");
	assert.equal(json.status, 0, json.stderr);
	const entries = json.stdout.trim().split("\n").map((line) => JSON.parse(line));
	assert.ok(entries.some((entry) => entry.type === "message_end" && entry.message?.role === "custom" && String(entry.message.content).includes("Configured parent choice: off")));
});
