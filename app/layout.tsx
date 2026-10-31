import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Clearway — Clearance Readiness Copilot",
  description: "From messy bundle to evidence-backed readiness case.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 font-sans">
        {children}
      </body>
    </html>
  );
}
