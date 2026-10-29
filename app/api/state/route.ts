import { fetchCandles, fetchSpot } from "../../../src/sources/coinbase.ts";
import { buildDashboard } from "../../../src/agents/dashboard.ts";
import type { DashboardInput } from "../../../src/agents/dashboard.ts";
import { createAccount } from "../../../src/paper/engine.ts";
import type { PaperAccount } from "../../../src/paper/engine.ts";
import type { Candle } from "../../../src/lib/types.ts";
import type { FetchLike } from "../../../src/sources/http.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PRODUCTS = ["BTC-USD", "ETH-USD", "SOL-USD"];
// Conta de paper trading em memória do processo (não durável: reinicia em cold start). Honesto por enquanto.
let account: PaperAccount | null = null;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const capital = Math.max(100, Number(url.searchParams.get("capital")) || 10000);
  const manualPause = url.searchParams.get("pause") === "1";
  if (!account || account.startEquity !== capital) account = createAccount(capital);
  const now = new Date();
  const f = fetch as unknown as FetchLike;

  const inputs: DashboardInput["inputs"] = [];
  const errors: string[] = [];
  for (const product of PRODUCTS) {
    const [candles, spot] = await Promise.all([fetchCandles(f, product, 86400, now), fetchSpot(f, product, now)]);
    if (candles.ok && spot.ok) {
      inputs.push({ product, candles: candles.value as Candle[], price: spot.value, priceCollectedAt: spot.collectedAt, priceSource: spot.source });
    } else {
      errors.push(`${product}: ${candles.ok ? "" : candles.error} ${spot.ok ? "" : spot.error}`.trim());
    }
  }

  const state = buildDashboard({ inputs, account, now, manualPause });
  return Response.json({ state, errors }, { headers: { "cache-control": "no-store" } });
}
