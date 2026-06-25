import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Multiplayer Channels",
  description: "ローカルLLM × 共有チャンネル（Claude Tag マルチプレイヤー相当）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden">
        {children}
        <footer className="shrink-0 border-t border-black/10 py-2 text-center text-xs text-foreground/40 dark:border-white/15">
          Multiplayer Channels — ローカルLLM × 共有チャンネル
        </footer>
      </body>
    </html>
  );
}
