import { createStore } from "../../../src/lib/runtime.ts";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Botão de pausa geral. Exige PAUSE_SECRET e banco (DATABASE_URL) para o estado valer em todos os ciclos. */
export async function POST(req: Request) {
  const secret = process.env["PAUSE_SECRET"];
  if (!secret) return Response.json({ error: "PAUSE_SECRET não configurado" }, { status: 503 });
  if (!process.env["DATABASE_URL"]) return Response.json({ error: "sem banco (DATABASE_URL): a pausa não seria persistida" }, { status: 503 });
  let body: { token?: unknown; paused?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (typeof body.token !== "string" || !same(body.token, secret)) return Response.json({ error: "não autorizado" }, { status: 401 });
  if (typeof body.paused !== "boolean") return Response.json({ error: "campo paused deve ser true ou false" }, { status: 400 });
  await createStore(process.env).setManualPause(body.paused);
  return Response.json({ paused: body.paused });
}
