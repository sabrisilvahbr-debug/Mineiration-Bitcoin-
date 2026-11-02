export type FetchLike = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export const DEFAULT_TIMEOUT_MS = 8000;

export async function getJson(fetchImpl: FetchLike, url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctl.signal, headers: { accept: "application/json", "user-agent": "trading-agentes-ia/0.1" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).host}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

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
