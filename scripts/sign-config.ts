// Assina guardian.config.json com o seu segredo (GUARDIAN_SECRET) e grava guardian.config.sig.
import { readFileSync, writeFileSync } from "node:fs";
import { parseGuardianConfig, signConfig } from "../src/guardian/config.ts";

const secret = process.env["GUARDIAN_SECRET"];
if (!secret) {
  console.error("Defina GUARDIAN_SECRET (segredo longo e aleatório, só seu) antes de assinar.");
  process.exit(1);
}
const cfg = parseGuardianConfig(JSON.parse(readFileSync("guardian.config.json", "utf8")));
const sig = signConfig(cfg, secret);
writeFileSync("guardian.config.sig", sig + "\n");
console.log("Assinatura gravada em guardian.config.sig. Coloque o mesmo valor em GUARDIAN_CONFIG_SIG no Vercel e no GitHub.");
