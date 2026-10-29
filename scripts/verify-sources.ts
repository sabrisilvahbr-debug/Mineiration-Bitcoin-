// Confere AO VIVO se cada API ainda responde no formato esperado. Rode no GitHub Actions ou na sua máquina.
import { fetchNetwork } from "../src/sources/mempool.ts";
import { fetchPrices } from "../src/sources/price.ts";
import { fetchPriceHistory } from "../src/sources/history.ts";
import { fetchNicehashRental, rentalMargin } from "../src/sources/rental.ts";
import type { FetchLike } from "../src/sources/http.ts";

const f = fetch as unknown as FetchLike;
let failed = 0;
const line = (ok: boolean, name: string, detail: string) => {
  if (!ok) failed++;
  console.log(`${ok ? "OK   " : "FALHA"} ${name}: ${detail}`);
};

const net = await fetchNetwork(f);
if (net.ok) {
  line(true, "mempool.space (rede)", `hashrate ${(net.value.networkPh / 1000).toFixed(1)} EH/s, hashprice ${net.value.hashpriceSatsPerPhDay.toFixed(0)} sats/PH/dia, ${net.value.hashrate.historyHs.length} pontos de histórico`);
  for (const w of net.value.warnings) line(false, "mempool.space (parcial)", w);
} else line(false, "mempool.space (rede)", net.error);

for (const p of await fetchPrices(f)) line(p.ok, p.source, p.ok ? `R$ ${p.value} em ${p.collectedAt}` : p.error);

const h = await fetchPriceHistory(f);
line(h.ok, "Histórico de preço", h.ok ? `${h.value.length} fechamentos diários (${h.source})` : h.error);

const rent = await fetchNicehashRental(f);
if (rent.ok) {
  const hpSats = net.ok ? net.value.hashpriceSatsPerPhDay : 0;
  const m = rentalMargin(rent.value.marketSatsPerPhDay, hpSats);
  line(true, "NiceHash (aluguel SHA256)", `${rent.value.marketSatsPerPhDay.toFixed(0)} sats/PH/dia (${rent.value.activeOrders} ordens, ${rent.value.acceptedEhs.toFixed(2)} EH/s)${m ? `; margem bruta vs. hashprice ${(m.grossMarginPct * 100).toFixed(1)}% ${m.profitable ? "(lucro)" : "(prejuizo)"}` : ""}`);
} else line(false, "NiceHash (aluguel SHA256)", rent.error);

console.log(failed === 0 ? "\nTodas as fontes responderam no formato esperado." : `\n${failed} problema(s): o código mostra "sem dado" nesses casos, mas o formato da API pode ter mudado.`);
process.exit(failed === 0 ? 0 : 1);
