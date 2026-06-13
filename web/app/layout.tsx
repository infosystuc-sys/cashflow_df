import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { CashflowProvider } from "@/context/CashflowContext";
import { AppShell } from "@/components/AppShell";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "CASHFLOW · Galicia · Nación",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={manrope.variable} data-density="regular">
        <CashflowProvider>
          <AppShell>{children}</AppShell>
        </CashflowProvider>
      </body>
    </html>
  );
}
