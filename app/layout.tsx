// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "Jacla Portal",
  description: "Jacla club portal",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {/* ここで全体を AuthProvider で包む */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
