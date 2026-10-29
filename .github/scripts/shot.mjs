import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("shots", { recursive: true });
const base = "http://localhost:3000/";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const log = [];
async function shoot(name, viewport, actions) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Mercado e sinais", { timeout: 60000 }).catch(() => log.push(`[${name}] painel não apareceu`));
  await page.waitForTimeout(6000);
  if (actions) await actions(page);
  await page.screenshot({ path: `shots/${name}.png`, fullPage: name.includes("full") });
  log.push(`[${name}] canvas:${await page.$("canvas") ? "sim" : "não"} docW:${await page.evaluate(() => document.documentElement.scrollWidth)}/${viewport.width}`);
  await ctx.close();
}
await shoot("desktop-3d", { width: 1360, height: 900 });
await shoot("celular-full", { width: 390, height: 844 });
await shoot("celular-lista-full", { width: 390, height: 844 }, async (p) => { await p.click("text=Lista dos 25 agentes"); await p.waitForTimeout(500); });
await browser.close();
writeFileSync("shots/log.txt", log.join("\n") + "\n");
console.log(log.join("\n"));
