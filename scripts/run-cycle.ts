// Roda um ciclo completo e grava no banco (usado pelo GitHub Actions a cada 5 min).
import { readFileSync, existsSync } from "node:fs";
import { runCycle } from "../src/agents/cycle.ts";
import { parseInputs } from "../src/agents/inputs.ts";
import { loadConfigFromEnv, createStore } from "../src/lib/runtime.ts";
import type { FetchLike } from "../src/sources/http.ts";

const env = { ...process.env } as Record<string, string | undefined>;
if (!env["GUARDIAN_CONFIG_SIG"] && existsSync("guardian.config.sig")) {
  env["GUARDIAN_CONFIG_SIG"] = readFileSync("guardian.config.sig", "utf8").trim();
}
const loaded = loadConfigFromEnv(env, JSON.parse(readFileSync("guardian.config.json", "utf8")));
const { inputs, errors } = parseInputs(new URLSearchParams(env["CYCLE_INPUTS"] ?? ""));
if (errors.length) console.warn("Entradas ignoradas:", errors.join("; "));

const store = createStore(env);
if (!store.durable) console.warn("DATABASE_URL ausente: o ciclo roda, mas nada é gravado de forma durável.");

const result = await runCycle({ fetch: fetch as unknown as FetchLike, now: new Date(), loaded, inputs, store, env, withScenarios: true });
console.log(result.report);
console.log(JSON.stringify({ at: result.at, state: result.verdict.state, decision: result.decision, refused: result.refused, notices: result.notices }));
if (result.refused) process.exit(2);
