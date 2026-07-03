import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfficePulse AI",
  description: "Backend verification dashboard for OfficePulse AI"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
