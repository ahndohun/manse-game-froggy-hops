import type { Metadata, Viewport } from "next";
import { DEFAULT_LOCALE, GAME_CONFIG } from "./game-config";
import "./globals.css";

export const metadata: Metadata = {
  title: GAME_CONFIG.title.en,
  description: GAME_CONFIG.summary.en,
  openGraph: {
    title: GAME_CONFIG.title.en,
    description: GAME_CONFIG.summary.en,
    images: [{ url: "/thumbnail.png", width: 1200, height: 630 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#062f35",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>{children}</body>
    </html>
  );
}
