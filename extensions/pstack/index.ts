import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";

const levels = ["full", "focused", "off"] as const;
type Level = typeof levels[number];
const defaultLevel: Level = "off";
const levelEntry = "pstack.level";
const tasksEntry = "pstack.tasks";
const skillPath = fileURLToPath(new URL("../../skills/pstack/SKILL.md", import.meta.url));
const commandSkillsPath = fileURLToPath(new URL("../../skills/pstack/commands", import.meta.url));
const taskSchema = Type.Object({
	title: Type.String({ minLength: 1, maxLength: 300 }),
	status: Type.Union([Type.Literal("pending"), Type.Literal("in-progress"), Type.Literal("done"), Type.Literal("skipped")]),
	reason: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
}, { additionalProperties: false });
const tasksSchema = Type.Array(taskSchema, { maxItems: 64 });
type Task = Static<typeof taskSchema>;

type Saved = { path: string; data?: Record<string, unknown>; raw?: string; level?: Level; error?: string };
type Choice = { level?: Level; source: string; saved: Saved; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLevel(value: unknown): value is Level {
	return levels.some((level) => level === value);
}

function savedConfig(): Saved {
	const path = join(getAgentDir(), "configs", "pstack.json");
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch (error) {
		if (isRecord(error) && error.code === "ENOENT") return { path, data: {}, level: defaultLevel };
		return { path, error: `Cannot read ${path}.` };
	}
	try {
		const data: unknown = JSON.parse(raw);
		if (!isRecord(data)) throw new Error("Expected a JSON object.");
		if (data.defaultLevel !== undefined && !isLevel(data.defaultLevel)) throw new Error("defaultLevel must be full, focused, or off.");
		return { path, raw, data, level: (data.defaultLevel as Level | undefined) ?? defaultLevel };
	} catch (error) {
		return { path, error: `Invalid ${path}: ${error instanceof SyntaxError ? "malformed JSON" : String(error)}. File left untouched.` };
	}
}

function latest(branch: ReturnType<ExtensionContext["sessionManager"]["getBranch"]>, customType: string): { data: unknown } | undefined {
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type === "custom" && entry.customType === customType) return { data: entry.data };
	}
	return undefined;
}

function resolveChoice(pi: ExtensionAPI, branch: ReturnType<ExtensionContext["sessionManager"]["getBranch"]>, saved: Saved): Choice {
	const flag = pi.getFlag("pstack-level");
	const errors: string[] = saved.error ? [saved.error] : [];
	if (flag !== undefined && !isLevel(flag)) errors.push("Invalid --pstack-level: expected full, focused, or off.");
	const entry = latest(branch, levelEntry);
	if (entry) {
		if (!isRecord(entry.data) || (!isLevel(entry.data.choice) && entry.data.choice !== "default")) {
			errors.push("Invalid pstack session choice. Use /pstack full, focused, off, or reset to replace it.");
			return { source: "invalid session choice", saved, errors };
		}
		if (entry.data.choice === "default") return { level: saved.level, source: "saved default (reset; CLI ignored)", saved, errors };
		return { level: entry.data.choice, source: "session", saved, errors };
	}
	if (flag !== undefined) return { level: isLevel(flag) ? flag : undefined, source: "CLI --pstack-level", saved, errors };
	return { level: saved.level, source: saved.raw === undefined && !saved.error ? "built-in default" : "saved default", saved, errors };
}

function validTasks(value: unknown): Task[] {
	if (!Array.isArray(value) || value.length > 64) throw new Error("pstack_tasks requires an array of at most 64 tasks.");
	let active = 0;
	return value.map((task, index) => {
		if (!isRecord(task) || Object.keys(task).some((key) => !["title", "status", "reason"].includes(key))) {
			throw new Error(`Task ${index + 1} must contain only title, status, and optional reason.`);
		}
		const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
		if (!text(task.title, 300)) throw new Error(`Task ${index + 1} title must be 1–300 characters with no control characters.`);
		if (typeof task.status !== "string" || !["pending", "in-progress", "done", "skipped"].includes(task.status)) throw new Error(`Task ${index + 1} has an invalid status.`);
		if (task.reason !== undefined && !text(task.reason, 500)) throw new Error(`Task ${index + 1} reason must be 1–500 characters with no control characters.`);
		if (task.status === "skipped" && task.reason === undefined) throw new Error(`Task ${index + 1} requires a reason when skipped.`);
		if (task.status === "in-progress" && ++active > 1) throw new Error("At most one task may be in-progress.");
		return { title: task.title as string, status: task.status as Task["status"], ...(task.reason === undefined ? {} : { reason: task.reason as string }) };
	});
}

function readTasks(branch: ReturnType<ExtensionContext["sessionManager"]["getBranch"]>): Task[] {
	const entry = latest(branch, tasksEntry);
	return entry ? validTasks(entry.data) : [];
}

function summary(tasks: Task[]): string {
	return `${tasks.filter((task) => task.status === "done").length}/${tasks.length} done, ${tasks.filter((task) => task.status === "skipped").length} skipped, ${tasks.filter((task) => task.status === "in-progress").length} active`;
}

function checklist(tasks: Task[]): string {
	return [`pstack checklist: ${summary(tasks)}`, ...(tasks.length ? tasks.map((task, index) => `${index + 1}. [${task.status}] ${task.title}${task.reason ? ` — Reason: ${task.reason}` : ""}`) : ["No tasks on this branch."])].join("\n");
}

function accessibleTools(pi: ExtensionAPI) {
	const active = new Set(pi.getActiveTools());
	return pi.getAllTools().filter((tool) => active.has(tool.name) || tool.exposure === "codemode" || tool.exposure === "deferred");
}

function agentTypes(parameters: unknown): string[] | undefined {
	if (!isRecord(parameters) || !isRecord(parameters.properties)) return undefined;
	const field = parameters.properties.subagent_type;
	if (!isRecord(field)) return undefined;
	const literals = (schema: Record<string, unknown>): string[] | undefined => {
		if (Array.isArray(schema.enum)) return schema.enum.filter((value): value is string => typeof value === "string");
		if (typeof schema.const === "string") return [schema.const];
		const variants = schema.anyOf ?? schema.oneOf;
		if (Array.isArray(variants) && variants.every(isRecord)) {
			const lists = variants.map(literals);
			if (lists.every((list) => list !== undefined)) return lists.flat();
		}
		return undefined;
	};
	const enumTypes = literals(field);
	if (enumTypes) return enumTypes;
	if (typeof field.description !== "string") return undefined;
	const list = field.description.match(/Available (?:types|agents):\s*([^\.\n]+)/i)?.[1] ?? field.description.match(/Available:\s*([^\.\n]+)/i)?.[1];
	return list?.split(",").map((name) => name.trim()).filter(Boolean);
}

function capability(pi: ExtensionAPI) {
	const tools = accessibleTools(pi);
	const agent = tools.find((tool) => tool.name === "Agent");
	const types = agent ? agentTypes(agent.parameters) : undefined;
	return { agent, types, names: tools.filter((tool) => ["Agent", "SubagentWorkflow", "get_subagent_result", "steer_subagent"].includes(tool.name)).map((tool) => tool.name) };
}

function inheritedLevel(text: string): Level | undefined {
	const matches = [...text.matchAll(/^pstack-level:[ \t]*(full|focused|off)[ \t]*$/gm)];
	return matches.at(-1)?.[1] as Level | undefined;
}

function isLeafPrompt(prompt: string): boolean {
	return /<sub_agent_context>|<active_agent\b|^pstack-role: leaf[ \t]*$/m.test(prompt);
}

function withoutInheritedPolicy(prompt: string): string {
	return prompt.replace(/<pstack>\n[\s\S]*?\n<\/pstack>/g, "");
}

function snapshot(pi: ExtensionAPI, ctx: ExtensionContext, prompt = ctx.getSystemPrompt(), inherited?: Level) {
	const branch = ctx.sessionManager.getBranch();
	const choice = resolveChoice(pi, branch, savedConfig());
	const caps = capability(pi);
	const leaf = isLeafPrompt(prompt);
	let effective: { level?: Level; source: string } = choice;
	if (leaf && !latest(branch, levelEntry)) {
		const assignment = latest(branch, "pstack.assignment");
		effective = assignment && isRecord(assignment.data) && isLevel(assignment.data.level)
			? { level: assignment.data.level, source: "parent brief" }
			: { level: inherited ?? inheritedLevel(prompt), source: "parent section/brief" };
	}
	return { choice, caps, leaf, effective, tasks: readTasks(branch) };
}
type Snapshot = ReturnType<typeof snapshot>;

function prerequisites(caps: ReturnType<typeof capability>): string {
	if (!caps.agent) return "Full prerequisites blocked: Agent is unavailable in this host. A delegated leaf executes only its assigned scope; a standalone parent needs TintinWeb Agent.";
	if (caps.types?.includes("general-purpose")) return "Full delegation available: Agent advertises general-purpose. Use the bundled worker or reviewer brief; no profile role installation is required.";
	return `Full prerequisites blocked: ${caps.types ? "general-purpose is not advertised by Agent" : "Agent type list cannot be verified"}. Enable TintinWeb's general-purpose agent and reload. Bundled role briefs need no profile installer. Do not silently switch to focused or another agent.`;
}

function display({ choice, caps, leaf, effective, tasks }: Snapshot): string {
	return [
		`pstack effective level: ${effective.level ?? (leaf ? "unassigned (leaf host; parent level required)" : "ERROR")}; source: ${effective.source}.`,
		`Configured parent choice: ${choice.level ?? "ERROR"} (${choice.source}). Saved default: ${choice.saved.level ?? "ERROR"}; config: ${choice.saved.path}.`,
		`Delegation tools: ${caps.names.join(", ") || "none"}. Agent types: ${caps.types?.join(", ") || "not advertised"}.`,
		prerequisites(caps),
		`Checklist: ${summary(tasks)}. View with /pstack; available even when off.`,
		...choice.errors.map((error) => `ERROR: ${error}`),
		"Precedence: session > CLI > saved default > off. Reset follows the saved default and ignores CLI. A valid session choice can override invalid lower-priority defaults without repairing them. Level changes do not cancel agents or grant permissions.",
	].join("\n");
}

function updateStatus(pi: ExtensionAPI, ctx: ExtensionContext, state?: Snapshot) {
	if (ctx.mode !== "tui") return;
	try {
		const { choice, leaf, effective, tasks } = state ?? snapshot(pi, ctx);
		ctx.ui.setStatus("pstack", `pstack ${effective.level ?? (leaf ? "leaf" : "ERROR")}${choice.errors.length ? " !" : ""} · tasks: /pstack · ${summary(tasks)}`);
	} catch {
		ctx.ui.setStatus("pstack", "pstack ERROR");
	}
}

function report(pi: ExtensionAPI, ctx: ExtensionContext, text: string, error = false) {
	if (ctx.hasUI) ctx.ui.notify(text, error ? "error" : "info");
	else {
		// Print mode emits only assistant replies; stderr keeps command reports visible and JSON stdout clean.
		if (ctx.mode === "print") process.stderr.write(`${text}\n`);
		pi.sendMessage({ customType: "pstack.status", content: text, display: true });
	}
}

function saveDefault(level: Level): string {
	const saved = savedConfig();
	if (saved.error || !saved.data) throw new Error(saved.error ?? "Invalid pstack config.");
	mkdirSync(dirname(saved.path), { recursive: true });
	const backup = saved.raw === undefined ? undefined : `${saved.path}.backup-${randomUUID()}`;
	if (backup) copyFileSync(saved.path, backup, constants.COPYFILE_EXCL);
	const temporary = `${saved.path}.tmp-${randomUUID()}`;
	try {
		writeFileSync(temporary, `${JSON.stringify({ ...saved.data, defaultLevel: level }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
		renameSync(temporary, saved.path);
	} finally {
		try { unlinkSync(temporary); } catch (error) { if (!isRecord(error) || error.code !== "ENOENT") throw error; }
	}
	return `Saved default ${level} in ${saved.path}.${backup ? ` Backup: ${backup}.` : ""} Session choice and CLI remain unchanged.`;
}

export default function pstack(pi: ExtensionAPI) {
	pi.on("resources_discover", () => ({ skillPaths: [commandSkillsPath] }));
	pi.registerFlag("pstack-level", { type: "string", description: "pstack level: full, focused, or off; session choice takes precedence" });

	const command = {
		description: "Show the checklist; status | full | focused | off | reset | save <level>",
		async handler(args: string, ctx: ExtensionContext) {
			try {
				if (!args.trim()) {
					report(pi, ctx, checklist(readTasks(ctx.sessionManager.getBranch())));
					return;
				}
				const parts = args.trim().split(/\s+/);
				const action = parts[0];
				if (action === "save" && parts.length === 2 && isLevel(parts[1])) report(pi, ctx, saveDefault(parts[1]));
				else if (parts.length === 1 && isLevel(action)) pi.appendEntry(levelEntry, { choice: action });
				else if (parts.length === 1 && action === "reset") {
					const saved = savedConfig();
					if (saved.error) throw new Error(saved.error);
					pi.appendEntry(levelEntry, { choice: "default" });
				} else if (parts.length !== 1 || action !== "status") throw new Error("Usage: /pstack (checklist) | status | full | focused | off | reset | save <full|focused|off>.");
				const state = snapshot(pi, ctx);
				report(pi, ctx, display(state));
				updateStatus(pi, ctx, state);
			} catch (error) {
				report(pi, ctx, `pstack ERROR: ${String(error)}`, true);
				updateStatus(pi, ctx);
			}
		},
	};
	pi.registerCommand("pstack", command);
	pi.registerCommand("poteto-mode", {
		description: "Enable pstack for this session: /poteto-mode [full|focused|off]",
		async handler(args, ctx) {
			const level = args.trim() || "full";
			if (!isLevel(level)) {
				report(pi, ctx, "Usage: /poteto-mode [full|focused|off].", true);
				return;
			}
			await command.handler(level, ctx);
		},
	});

	pi.registerTool({
		name: "pstack_tasks",
		label: "pstack tasks",
		description: "Read or replace the ordered checklist on the active session branch. At most 64 tasks; title ≤300 and optional reason ≤500 single-line characters; one in-progress task; skipped requires a reason. Does not change pstack level or authorize actions. Replace is sequential and replaces the complete list. Full output is returned without truncation.",
		parameters: Type.Union([
			Type.Object({ action: Type.Literal("read") }, { additionalProperties: false }),
			Type.Object({ action: Type.Literal("replace"), tasks: tasksSchema }, { additionalProperties: false }),
		]),
		outputSchema: Type.Object({ tasks: tasksSchema }, { additionalProperties: false }),
		executionMode: "sequential",
		async execute(_id, params, _signal, _onUpdate, ctx) {
			if (!isRecord(params) || Object.keys(params).some((key) => !["action", "tasks"].includes(key))) throw new Error("pstack_tasks accepts only action and tasks; it cannot change level.");
			let tasks: Task[];
			if (params.action === "replace") {
				tasks = validTasks(params.tasks);
				pi.appendEntry(tasksEntry, tasks);
			} else if (params.action === "read" && !("tasks" in params)) tasks = readTasks(ctx.sessionManager.getBranch());
			else throw new Error("pstack_tasks requires action read, or replace with tasks.");
			updateStatus(pi, ctx);
			const text = checklist(tasks);
			return { content: [{ type: "text", text }], details: { tasks }, structuredContent: { tasks } };
		},
	});

	pi.on("session_start", (_event, ctx) => {
		const state = snapshot(pi, ctx);
		if (state.choice.errors.length) report(pi, ctx, `pstack ERROR:\n${state.choice.errors.join("\n")}`, true);
		updateStatus(pi, ctx, state);
	});
	pi.on("session_tree", (_event, ctx) => updateStatus(pi, ctx));
	pi.on("before_agent_start", (event, ctx) => {
		const sections = event.systemPromptOptions.sections;
		const prompt = event.systemPromptOptions.customPrompt ?? event.systemPrompt;
		const leaf = isLeafPrompt(prompt);
		if (leaf) {
			const briefLevel = inheritedLevel(event.prompt);
			if (briefLevel) pi.appendEntry("pstack.assignment", { level: briefLevel });
		}
		const state = snapshot(pi, ctx, prompt, inheritedLevel(sections.pstack ?? "") ?? inheritedLevel(prompt));
		if (leaf) {
			if (event.systemPromptOptions.customPrompt !== undefined) event.systemPromptOptions.customPrompt = withoutInheritedPolicy(event.systemPromptOptions.customPrompt);
			event.systemPromptOptions.appendSystemPrompt = withoutInheritedPolicy(event.systemPromptOptions.appendSystemPrompt);
			const { level } = state.effective;
			if (level === "off") delete sections.pstack;
			else sections.pstack = [
				`pstack-level: ${level ?? "unassigned"}`,
				"pstack-role: leaf",
				`Workflow reference: ${skillPath}.`,
				"Execute only the assigned scope at the parent-provided level from the inherited pstack section or explicit pstack-level brief. Parent owns design, delegation, review, and integration gates. Do not restart Feature, architect, or recursive delegation, and do not restore the global default. If level is unassigned, request the parent's level when needed; a standalone parent lacks Agent prerequisites. Preserve safety and repository rules.",
			].join("\n");
		} else {
			const { choice, caps } = state;
			if (choice.level === "off") delete sections.pstack;
			else sections.pstack = [
				`pstack-level: ${choice.level ?? "ERROR"}`,
				"pstack-role: parent",
				`For meaningful work, read ${skillPath} and apply the ${choice.level ?? "unresolved"} playbook. Ordinary questions and casual replies need no workflow ceremony. Parent owns design, delegation, independent review, integration, and acceptance.`,
				choice.level === "full" ? prerequisites(caps) : "",
				...choice.errors.map((error) => `Configuration error: ${error}`),
				choice.level ? "Workflow level grants no permission and does not relax safety, branch ownership, or mandatory project reviews/tests." : "Workflow level is unresolved. Report the configuration error and ask the user to choose a valid level; do not silently apply full or focused.",
			].filter(Boolean).join("\n");
		}
		updateStatus(pi, ctx, state);
	});
}
