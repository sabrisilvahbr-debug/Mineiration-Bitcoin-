// Confere AO VIVO as fontes reais e roda um backtest com dados reais. Para o CI ou sua máquina.
import { fetchCandles, fetchSpot } from "../src/sources/coinbase.ts";
import { backtest, outOfSample, DEFAULT_COSTS } from "../src/intelligence/backtest.ts";
import { DEFAULT_PARAMS } from "../src/intelligence/strategy.ts";
import type { FetchLike } from "../src/sources/http.ts";

const f = fetch as unknown as FetchLike;
let failed = 0;
const line = (ok: boolean, name: string, detail: string) => { if (!ok) failed++; console.log(`${ok ? "OK   " : "FALHA"} ${name}: ${detail}`); };

for (const product of ["BTC-USD", "ETH-USD"]) {
  const spot = await fetchSpot(f, product);
  line(spot.ok, `Preço ${product}`, spot.ok ? `US$ ${spot.value} (${spot.source})` : spot.error);
  const candles = await fetchCandles(f, product, 86400);
  if (candles.ok) {
    const closes = candles.value.map((c) => c.close);
    line(true, `Candles ${product}`, `${candles.value.length} barras diárias reais`);
    const bt = backtest(closes, DEFAULT_PARAMS, DEFAULT_COSTS, 10000);
    const oos = outOfSample(closes, DEFAULT_PARAMS, DEFAULT_COSTS, 0.7);
    console.log(`     Backtest ${product}: estratégia ${bt.returnPct.toFixed(1)}% vs comprar-e-segurar ${bt.buyHoldReturnPct.toFixed(1)}%, drawdown ${bt.maxDrawdownPct.toFixed(1)}%, ${bt.trades} trades, Sharpe ${bt.sharpe.toFixed(2)}`);
    console.log(`     Fora da amostra: ${oos.approved ? "APROVADA" : "REPROVADA"} (teste ${oos.test.returnPct.toFixed(1)}% vs B&H ${oos.test.buyHoldReturnPct.toFixed(1)}%)`);
  } else line(false, `Candles ${product}`, candles.error);
}
console.log(failed === 0 ? "\nFontes reais OK." : `\n${failed} problema(s): o código mostra "sem dado" nesses casos.`);
process.exit(failed === 0 ? 0 : 1);
