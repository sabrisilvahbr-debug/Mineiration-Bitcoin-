// SONDAGEM (temporária): imprime o JSON cru de endpoints públicos de preço de aluguel,
// para descobrir o formato real e a UNIDADE do preço (BTC por PH/s ou por TH/s por dia)
// antes de escrever o parser definitivo. Não faz parte do produto.
const endpoints: Array<[string, string]> = [
  ["simplemultialgo", "https://api2.nicehash.com/main/api/v2/public/simplemultialgo/info"],
  ["buy-info", "https://api2.nicehash.com/main/api/v2/public/buy/info"],
  ["orders-active2-SHA256ASICBOOST", "https://api2.nicehash.com/main/api/v2/public/orders/active2?algorithm=SHA256ASICBOOST"],
  ["stats-global-current", "https://api2.nicehash.com/main/api/v2/public/stats/global/current"],
];

function pick(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

for (const [name, url] of endpoints) {
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    const j: unknown = await res.json();
    console.log(`\n===== ${name} (HTTP ${res.status}) =====`);
    if (name === "simplemultialgo") {
      const algos = pick(j, "miningAlgorithms");
      const sha = Array.isArray(algos) ? algos.filter((a) => JSON.stringify(a).toUpperCase().includes("SHA256")) : algos;
      console.log(JSON.stringify(sha, null, 2));
      console.log("exemplo de 1 item (chaves):", Array.isArray(algos) && algos[0] ? Object.keys(algos[0] as object) : "n/a");
    } else if (name === "buy-info") {
      const algos = pick(j, "miningAlgorithms");
      const sha = Array.isArray(algos) ? algos.filter((a) => JSON.stringify(a).toUpperCase().includes("SHA256")) : null;
      console.log("chaves topo:", j && typeof j === "object" ? Object.keys(j) : "n/a");
      console.log("SHA256:", JSON.stringify(sha, null, 2).slice(0, 2500));
    } else if (name === "stats-global-current") {
      const algos = pick(j, "algos");
      console.log("chaves topo:", j && typeof j === "object" ? Object.keys(j) : "n/a");
      console.log("algos (amostra):", JSON.stringify(Array.isArray(algos) ? algos.slice(0, 6) : algos, null, 2));
    } else {
      const s = JSON.stringify(j, null, 2);
      console.log(s.slice(0, 3000));
      if (j && typeof j === "object") console.log("chaves topo:", Object.keys(j));
    }
  } catch (e) {
    console.log(`\n===== ${name} =====\nERRO: ${(e as Error).message}`);
  }
}
