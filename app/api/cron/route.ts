import guardianJson from "../../../guardian.config.json";
import { runCycle } from "../../../src/agents/cycle.ts";
import { parseInputs } from "../../../src/agents/inputs.ts";
import { loadConfigFromEnv, createStore } from "../../../src/lib/runtime.ts";
import type { FetchLike } from "../../../src/sources/http.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Ciclo completo com gravação. Protegido por CRON_SECRET (o Vercel Cron envia "Authorization: Bearer <CRON_SECRET>"). */
export async function GET(req: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("não autorizado", { status: 401 });
  }
  const { inputs } = parseInputs(new URLSearchParams(process.env["CYCLE_INPUTS"] ?? ""));
  const result = await runCycle({
    fetch: fetch as unknown as FetchLike,
    now: new Date(),
    loaded: loadConfigFromEnv(process.env, guardianJson),
    inputs,
    store: createStore(process.env),
    env: process.env,
    withScenarios: true,
  });
  return Response.json({ at: result.at, state: result.verdict.state, decision: result.decision, refused: result.refused });
}
