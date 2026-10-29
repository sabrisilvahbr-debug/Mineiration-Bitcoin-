// Auxiliar de CI: abre o site e salva capturas de tela (desktop e celular). Usa entradas de TESTE só para preencher o painel.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("shots", { recursive: true });
const base = "http://localhost:3000/?ph=1&preco=100&taxaPool=2&taxaPlat=3";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"] });
const log = [];

async function shoot(name, viewport, actions) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", (m) => log.push(`[${name}] console.${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => log.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Mercado (dados reais)", { timeout: 60000 }).catch(() => log.push(`[${name}] painel não apareceu`));
  await page.waitForTimeout(4000);
  if (actions) await actions(page);
  await page.screenshot({ path: `shots/${name}.png`, fullPage: name.includes("full") });
  const canvas = await page.$("canvas");
  log.push(`[${name}] canvas presente: ${canvas ? "sim" : "não"}; largura do documento ${await page.evaluate(() => document.documentElement.scrollWidth)} / janela ${viewport.width}`);
  await ctx.close();
}

await shoot("desktop-3d", { width: 1280, height: 900 });
await shoot("desktop-lista", { width: 1280, height: 900 }, async (p) => { await p.click("text=Lista dos 25 agentes"); await p.waitForTimeout(500); });
await shoot("celular-full", { width: 390, height: 844 });
await shoot("celular-lista-full", { width: 390, height: 844 }, async (p) => { await p.click("text=Lista dos 25 agentes"); await p.waitForTimeout(500); });
await browser.close();
import { writeFileSync } from "node:fs";
writeFileSync("shots/log.txt", log.join("\n") + "\n");
console.log(log.join("\n"));
// 1793266282
// 1793266434
