import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const usageFile = new URL("../.local/ai-usage.json", import.meta.url);
let spent = 0;
try {
  spent = JSON.parse(await readFile(usageFile, "utf8")).reserved ?? 0;
} catch {}
let reservationQueue: Promise<unknown> = Promise.resolve();
export const aiReady = () =>
  !!process.env.ANTHROPIC_API_KEY || process.env.PACT_AI === "claude-code";
async function reserveBudget() {
  const perRequest = Math.min(
    Number(process.env.PACT_AI_REQUEST_CAP ?? 0.15),
    0.5,
  );
  const cap = Number(process.env.PACT_AI_SESSION_CAP ?? 1);
  const task = reservationQueue.then(async () => {
    if (
      !Number.isFinite(cap) ||
      !Number.isFinite(perRequest) ||
      perRequest <= 0 ||
      spent + perRequest > cap
    )
      throw new Error(
        "The local prototype AI budget is reached. Your Pact is saved.",
      );
    spent += perRequest;
    await mkdir(new URL("../.local/", import.meta.url), {
      recursive: true,
      mode: 0o700,
    });
    const temp = new URL(
      `ai-usage.${randomUUID()}.tmp`,
      new URL("../.local/", import.meta.url),
    );
    await writeFile(temp, JSON.stringify({ reserved: spent, cap }), {
      mode: 0o600,
    });
    await rename(temp, usageFile);
    return perRequest;
  });
  reservationQueue = task.catch(() => {});
  return task;
}
// Opt-in local hackathon/testing adapter. Uses Claude Code's supported signed-in CLI;
// no credential extraction, filesystem tools, MCP servers or action tools are available.
export async function askClaude(
  system: string,
  content: string,
): Promise<string> {
  if (process.env.PACT_AI === "claude-code") {
    const cap = await reserveBudget();
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.env.PACT_CLAUDE_BIN ?? join(homedir(), ".local/bin/claude"),
        [
          "-p",
          "--output-format",
          "json",
          "--no-session-persistence",
          "--tools",
          "",
          "--strict-mcp-config",
          "--mcp-config",
          '{"mcpServers":{}}',
          "--max-budget-usd",
          String(cap),
          "--system-prompt",
          system,
        ],
        {
          cwd: new URL("../.local/", import.meta.url),
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      let output = "";
      let error = "";
      const timeout = setTimeout(() => child.kill("SIGTERM"), 90000);
      child.stdout.on("data", (chunk) => {
        output += String(chunk);
        if (output.length > 1000000) child.kill("SIGTERM");
      });
      child.stderr.on("data", (chunk) => {
        error += String(chunk).slice(0, 1000);
      });
      child.on("error", () => {
        clearTimeout(timeout);
        reject(
          new Error(
            "Claude Code could not start. Check the local companion setup.",
          ),
        );
      });
      child.on("close", () => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(output);
          if (
            result.is_error ||
            result.subtype !== "success" ||
            typeof result.result !== "string"
          )
            throw new Error();
          resolve(result.result);
        } catch {
          reject(
            new Error(
              "Claude Code could not return a reply within the prototype budget. Your Pact is saved.",
            ),
          );
        }
      });
      child.stdin.end(content);
    });
  }
  if (!process.env.ANTHROPIC_API_KEY)
    throw new Error("AI isn’t connected. Your Pact is saved.");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 1800,
      system,
      messages: [{ role: "user", content }],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Claude’s usage limit was reached. Your Pact is saved."
        : "Claude could not respond. Check the companion setup.",
    );
  const body = await response.json();
  return (
    body.content
      ?.filter((x: any) => x.type === "text")
      .map((x: any) => x.text)
      .join("") ?? ""
  );
}
