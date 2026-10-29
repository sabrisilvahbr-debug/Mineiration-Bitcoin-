import { loadGuardianConfig } from "../guardian/config.ts";
import type { LoadedConfig } from "../guardian/config.ts";
import { MemoryStore } from "../store/memory.ts";
import { NeonStore } from "../store/neon.ts";
import type { Store } from "../store/store.ts";

export type Env = Record<string, string | undefined>;

export function loadConfigFromEnv(env: Env, raw: unknown): LoadedConfig {
  return loadGuardianConfig(raw, env["GUARDIAN_CONFIG_SIG"]?.trim() || undefined, env["GUARDIAN_SECRET"]?.trim() || undefined);
}

let memory: MemoryStore | null = null;
export function createStore(env: Env): Store {
  const url = env["DATABASE_URL"]?.trim();
  if (url) return new NeonStore(url);
  memory ??= new MemoryStore();
  return memory;
}
