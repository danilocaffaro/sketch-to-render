import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SketchRender — Sketch to Photorealistic Render",
  description:
    "Transform architectural sketches into photorealistic renders using Gemini Vision AI. For architects, interior designers, and creative professionals.",
  openGraph: {
    title: "SketchRender — AI Architectural Rendering",
    description: "Upload a sketch. Get a photorealistic render in seconds.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
