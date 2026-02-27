import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sketch to Render — AI Architectural Visualization",
  description:
    "Transform your architectural sketches into photorealistic renders in seconds using AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
