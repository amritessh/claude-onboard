import Anthropic from "@anthropic-ai/sdk";
import { resolveAnthropicKey } from "./auth";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: resolveAnthropicKey() });
  }
  return _client;
}

const DEFAULT_MODEL = "claude-opus-4-5";

export async function generateText(
  system: string,
  prompt: string,
  maxTokens = 4096
): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text;
}

export async function* streamText(
  system: string,
  prompt: string,
  maxTokens = 4096
): AsyncGenerator<string> {
  const client = getClient();
  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

export type MessageParam = Anthropic.MessageParam;
export type Tool = Anthropic.Tool;

export interface ToolLoopResult {
  finalText: string;
  iterations: number;
}

export async function runToolLoop(
  system: string,
  initialPrompt: string,
  tools: Tool[],
  toolExecutor: (name: string, input: Record<string, unknown>) => Promise<unknown>,
  maxIterations = 20
): Promise<ToolLoopResult> {
  const client = getClient();
  const messages: MessageParam[] = [
    { role: "user", content: initialPrompt },
  ];
  let iterations = 0;
  let finalText = "";

  while (iterations < maxIterations) {
    iterations++;
    const response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 8096,
      system,
      tools,
      messages,
    });

    const assistantContent = response.content;
    messages.push({ role: "assistant", content: assistantContent });

    if (response.stop_reason === "end_turn") {
      const textBlock = assistantContent.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") finalText = textBlock.text;
      break;
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of assistantContent) {
        if (block.type !== "tool_use") continue;
        try {
          const result = await toolExecutor(block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: typeof result === "string" ? result : JSON.stringify(result),
          });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    break;
  }

  return { finalText, iterations };
}
