import type { ReactNode } from "react";
import "./globals.css";
export const metadata = { title: "Escritório de Trading", description: "25 agentes operam com dados reais em paper trading, e param quando não compensa." };
export const viewport = { width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="pt-BR"><body>{children}</body></html>);
}
