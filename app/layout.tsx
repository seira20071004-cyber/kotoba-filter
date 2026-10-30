import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ことばフィルター",
  description: "共有前の文章から、個人情報・機密情報の候補を端末内でチェック。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
