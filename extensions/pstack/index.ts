import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";

const tasksEntry = "pstack.tasks";
const commandSkillsPath = fileURLToPath(new URL("../../skills/pstack/commands", import.meta.url));
const taskSchema = Type.Object({
	title: Type.String({ minLength: 1, maxLength: 300 }),
	status: Type.Union([Type.Literal("pending"), Type.Literal("in-progress"), Type.Literal("done"), Type.Literal("skipped")]),
	reason: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
}, { additionalProperties: false });
const tasksSchema = Type.Array(taskSchema, { maxItems: 64 });
type Task = Static<typeof taskSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry.type === "custom" && entry.customType === tasksEntry) return validTasks(entry.data);
	}
	return [];
}

function summary(tasks: Task[]): string {
	return `${tasks.filter((task) => task.status === "done").length}/${tasks.length} done, ${tasks.filter((task) => task.status === "skipped").length} skipped, ${tasks.filter((task) => task.status === "in-progress").length} active`;
}

function checklist(tasks: Task[]): string {
	return [`pstack checklist: ${summary(tasks)}`, ...(tasks.length ? tasks.map((task, index) => `${index + 1}. [${task.status}] ${task.title}${task.reason ? ` — Reason: ${task.reason}` : ""}`) : ["No tasks on this branch."])].join("\n");
}

function updateStatus(ctx: ExtensionContext) {
	if (ctx.mode !== "tui") return;
	try {
		const tasks = readTasks(ctx.sessionManager.getBranch());
		ctx.ui.setStatus("pstack", tasks.length ? `tasks: /pstack · ${summary(tasks)}` : undefined);
	} catch {
		ctx.ui.setStatus("pstack", "pstack checklist ERROR");
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

function withoutLegacyMode(prompt: string): string {
	// Older sessions and append-mode children can carry the retired controller's tagged policy.
	return prompt.replace(/<pstack>\r?\n[\s\S]*?<\/pstack>/g, (section) => /^pstack-level:/m.test(section) ? "" : section);
}

export default function pstack(pi: ExtensionAPI) {
	pi.on("resources_discover", () => ({ skillPaths: [commandSkillsPath] }));
	pi.registerCommand("pstack", {
		description: "Show the checklist on the active session branch",
		async handler(args, ctx) {
			try {
				if (args.trim()) throw new Error("Usage: /pstack (checklist). Select a workflow with /skill:pstack-poteto-mode or /skill:pstack-architect.");
				report(pi, ctx, checklist(readTasks(ctx.sessionManager.getBranch())));
			} catch (error) {
				report(pi, ctx, `pstack ERROR: ${String(error)}`, true);
			}
			updateStatus(ctx);
		},
	});

	pi.registerTool({
		name: "pstack_tasks",
		label: "pstack tasks",
		description: "Read or replace the ordered checklist on the active session branch. At most 64 tasks; title ≤300 and optional reason ≤500 single-line characters; one in-progress task; skipped requires a reason. Does not select a workflow or authorize actions. Replace is sequential and replaces the complete list. Full output is returned without truncation.",
		parameters: Type.Union([
			Type.Object({ action: Type.Literal("read") }, { additionalProperties: false }),
			Type.Object({ action: Type.Literal("replace"), tasks: tasksSchema }, { additionalProperties: false }),
		]),
		outputSchema: Type.Object({ tasks: tasksSchema }, { additionalProperties: false }),
		executionMode: "sequential",
		async execute(_id, params, _signal, _onUpdate, ctx) {
			if (!isRecord(params) || Object.keys(params).some((key) => !["action", "tasks"].includes(key))) throw new Error("pstack_tasks accepts only action and tasks.");
			let tasks: Task[];
			if (params.action === "replace") {
				tasks = validTasks(params.tasks);
				pi.appendEntry(tasksEntry, tasks);
			} else if (params.action === "read" && !("tasks" in params)) tasks = readTasks(ctx.sessionManager.getBranch());
			else throw new Error("pstack_tasks requires action read, or replace with tasks.");
			updateStatus(ctx);
			return { content: [{ type: "text", text: checklist(tasks) }], details: { tasks }, structuredContent: { tasks } };
		},
	});

	pi.on("session_start", (_event, ctx) => updateStatus(ctx));
	pi.on("session_tree", (_event, ctx) => updateStatus(ctx));
	pi.on("before_agent_start", (event) => {
		const options = event.systemPromptOptions;
		if (/^pstack-level:/m.test(options.sections.pstack ?? "")) delete options.sections.pstack;
		if (options.customPrompt !== undefined) options.customPrompt = withoutLegacyMode(options.customPrompt);
		options.appendSystemPrompt = withoutLegacyMode(options.appendSystemPrompt);
	});
}
