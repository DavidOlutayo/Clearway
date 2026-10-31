import type { ReactNode } from "react";

export const metadata = {
  title: "Clearway — Clearance Readiness Copilot",
  description: "From messy bundle to evidence-backed readiness case.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#f6f5f1" }}>
        {children}
      </body>
    </html>
  );
}
