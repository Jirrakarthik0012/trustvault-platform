import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/toast-provider";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: { default: "TrustVault — Secure document access", template: "%s | TrustVault" },
  description: "Secure sharing, Smarter Access, Verifiable Accountability."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <ToastProvider />
        </AuthProvider>
      </body>
    </html>
  );
}
