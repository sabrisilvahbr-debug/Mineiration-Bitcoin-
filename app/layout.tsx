import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Escritório Virtual de Mineração",
  description: "25 agentes acompanham mineração de Bitcoin com dados reais e pausam quando a conta dá prejuízo.",
};

export const viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
