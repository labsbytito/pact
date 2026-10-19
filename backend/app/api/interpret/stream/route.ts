import { fail, json } from "../../../../lib/http";
import { holdPact, interpretInput, runInterpretation } from "../../../../lib/interpret";
import { limitInterpret } from "../../../../lib/rate-limit";
import { authed, isResponse } from "../../../../lib/route";
import { openStore } from "../../../../lib/store";
import { toolsFor } from "../../../../lib/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let release = () => {};
  try {
    const gate = await authed(req);
    if (isResponse(gate)) return gate;
    await limitInterpret(openStore(), gate.installId);
    const body = interpretInput.parse(await req.json());
    release = holdPact(body.pact.id);
    const encoder = new TextEncoder();
    const abort = new AbortController();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        try {
          const result = await runInterpretation({
            pact: body.pact,
            actions: gate.session.actions,
            tools: toolsFor(gate.session),
            signal: abort.signal,
            responseStyle: body.responseStyle,
            askBefore: body.askBefore,
            onDelta: (text) => send({ type: "delta", text }),
          });
          if ("stopped" in result && result.stopped) send({ type: "stopped", reply: result.reply });
          else send({ type: "done", ...result });
        } catch (error) {
          send({
            type: "error",
            error: error instanceof Error ? error.message : "Pact could not finish that reply.",
          });
        } finally {
          release();
          controller.close();
        }
      },
      cancel() {
        abort.abort();
      },
    });
    const headers = new Headers(json(req, {}).headers);
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("X-Accel-Buffering", "no");
    headers.set("Content-Encoding", "none");
    return new Response(stream, { headers });
  } catch (error) {
    release();
    return fail(req, error);
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: json(req, {}).headers });
}
