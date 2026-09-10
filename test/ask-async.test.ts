import assert from "node:assert/strict";
import test from "node:test";
import askAsync from "../extensions/ask-async.ts";

type Tool = {
  execute: (...args: any[]) => Promise<any>;
};

function registerExtension(): { tool: Tool; sent: Array<{ text: string; options?: unknown }> } {
  let tool: Tool | undefined;
  const sent: Array<{ text: string; options?: unknown }> = [];
  askAsync({
    registerTool(definition: Tool) {
      tool = definition;
    },
    sendUserMessage(text: string, options?: unknown) {
      sent.push({ text, options });
    },
  } as any);
  assert.ok(tool);
  return { tool, sent };
}

test("ask_async reports that headless sessions cannot ask", async () => {
  const { tool } = registerExtension();
  const result = await tool.execute("id", { question: "Choose?" }, undefined, undefined, {
    hasUI: false,
  });

  assert.equal(result.details.asked, false);
  assert.match(result.content[0].text, /No interactive user/);
});

test("ask_async returns before delivering the eventual answer", async () => {
  const { tool, sent } = registerExtension();
  let answerQuestion: (answer: string) => void = () => {};
  const answer = new Promise<string>((resolve) => {
    answerQuestion = resolve;
  });
  const context = {
    hasUI: true,
    isIdle: () => false,
    ui: {
      input: () => answer,
      notify: () => {},
    },
  };

  const result = await tool.execute("id", { question: "Choose?" }, undefined, undefined, context);
  assert.equal(result.details.asked, true);
  assert.deepEqual(sent, []);

  answerQuestion("Option A");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(sent, [
    {
      text: 'Answering your question "Choose?": Option A',
      options: { deliverAs: "steer" },
    },
  ]);
});
