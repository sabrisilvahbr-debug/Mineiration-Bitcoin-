export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export const DEFAULT_TIMEOUT_MS = 8000;

async function request(fetchImpl: FetchLike, url: string, timeoutMs: number) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctl.signal, headers: { accept: "application/json", "user-agent": "escritorio-virtual-mineracao/0.1" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).host}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson(fetchImpl: FetchLike, url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  return (await request(fetchImpl, url, timeoutMs)).json();
}

export async function getText(fetchImpl: FetchLike, url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  return (await request(fetchImpl, url, timeoutMs)).text();
}

/** Número vindo de JSON como number ou string numérica; qualquer outra coisa → erro. */
export function num(x: unknown, name: string): number {
  const v = typeof x === "string" && x.trim() !== "" ? Number(x) : x;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new TypeError(`campo ${name} não é número`);
  return v;
}

export function obj(x: unknown, name: string): Record<string, unknown> {
  if (typeof x !== "object" || x === null || Array.isArray(x)) throw new TypeError(`${name} não é objeto`);
  return x as Record<string, unknown>;
}

export function arr(x: unknown, name: string): unknown[] {
  if (!Array.isArray(x)) throw new TypeError(`${name} não é lista`);
  return x;
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
