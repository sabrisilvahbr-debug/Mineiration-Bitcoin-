import guardianJson from "../../../guardian.config.json";
import { runCycle } from "../../../src/agents/cycle.ts";
import { parseInputs } from "../../../src/agents/inputs.ts";
import { loadConfigFromEnv, createStore } from "../../../src/lib/runtime.ts";
import { readOnly } from "../../../src/store/store.ts";
import type { FetchLike } from "../../../src/sources/http.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Estado completo para o painel. Só leitura: não grava histórico a cada atualização. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { inputs, errors } = parseInputs(url.searchParams);
  const loaded = loadConfigFromEnv(process.env, guardianJson);
  const store = readOnly(createStore(process.env));
  const result = await runCycle({
    fetch: fetch as unknown as FetchLike,
    now: new Date(),
    loaded,
    inputs,
    store,
    env: process.env,
    withScenarios: url.searchParams.get("cenarios") !== "0",
  });
  return Response.json({ result, inputErrors: errors, durable: store.durable }, { headers: { "cache-control": "no-store" } });
}
