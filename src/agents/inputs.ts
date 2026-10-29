import type { AsicInput, RentedInput, PoolMethod } from "../intelligence/profitability.ts";

/** Entradas que SÓ o CEO informa. Sem elas, o sistema não calcula custo nem margem. */
export interface UserInputs {
  rented?: Pick<RentedInput, "ph" | "pricePerPhDayBrl" | "poolFee" | "platformFee">;
  asic?: Pick<AsicInput, "ph" | "kw" | "tariffBrlKwh" | "hostingBrlDay" | "maintenanceBrlDay" | "poolFee">;
  poolMethod: PoolMethod;
  /** Endereço BTC de autocustódia que recebe os pagamentos (só leitura on-chain). */
  wallet?: string;
}

export interface ParsedInputs {
  inputs: UserInputs;
  errors: string[];
}

function field(q: URLSearchParams, key: string, errors: string[], max = Infinity): number | undefined {
  const raw = q.get(key);
  if (raw === null || raw.trim() === "") return undefined;
  const v = Number(raw.replace(",", "."));
  if (!Number.isFinite(v) || v < 0 || v > max) {
    errors.push(`${key}: valor inválido`);
    return undefined;
  }
  return v;
}

/** Lê os parâmetros da URL (ph, preco, taxaPool, taxaPlat, kw, tarifa, hosp, manut, metodo). Taxas em %. */
export function parseInputs(q: URLSearchParams): ParsedInputs {
  const errors: string[] = [];
  const ph = field(q, "ph", errors, 1_000_000);
  const preco = field(q, "preco", errors);
  const taxaPool = field(q, "taxaPool", errors, 100);
  const taxaPlat = field(q, "taxaPlat", errors, 100);
  const kw = field(q, "kw", errors, 100_000);
  const tarifa = field(q, "tarifa", errors);
  const hosp = field(q, "hosp", errors);
  const manut = field(q, "manut", errors);
  const metodoRaw = (q.get("metodo") ?? "FPPS").toUpperCase();
  const poolMethod: PoolMethod = metodoRaw === "PPLNS" || metodoRaw === "SOLO" ? metodoRaw : "FPPS";
  if (!["FPPS", "PPLNS", "SOLO"].includes(metodoRaw)) errors.push("metodo: use FPPS, PPLNS ou SOLO");

  const inputs: UserInputs = { poolMethod };
  const carteira = (q.get("carteira") ?? "").trim();
  if (carteira) inputs.wallet = carteira;
  // Aluguel só existe se o CEO informou PH, preço e as duas taxas (nenhuma taxa é presumida).
  if (ph !== undefined && preco !== undefined && taxaPool !== undefined && taxaPlat !== undefined) {
    inputs.rented = { ph, pricePerPhDayBrl: preco, poolFee: taxaPool / 100, platformFee: taxaPlat / 100 };
  }
  if (ph !== undefined && kw !== undefined && tarifa !== undefined && taxaPool !== undefined) {
    inputs.asic = { ph, kw, tariffBrlKwh: tarifa, hostingBrlDay: hosp ?? 0, maintenanceBrlDay: manut ?? 0, poolFee: taxaPool / 100 };
  }
  return { inputs, errors };
}
