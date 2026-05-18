import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Live-Presence Authorization Demo",
  description: "Software-led cardiac live-presence authorization MVP",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
