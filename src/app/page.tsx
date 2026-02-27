"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";

const STYLES = [
  "modern interior",
  "scandinavian minimal",
  "industrial loft",
  "luxury contemporary",
  "japandi zen",
  "mid-century modern",
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{ imageData: string; mimeType: string; analysis: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState(STYLES[0]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.match(/image\/(jpeg|png|webp)/)) {
      setError("Please upload a JPG, PNG or WebP image.");
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("style", style);

      const res = await fetch("/api/render", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to generate render");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = `data:${result.mimeType};base64,${result.imageData}`;
    a.download = `render-${Date.now()}.png`;
    a.click();
  };

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold text-sm">S</div>
            <span className="font-semibold tracking-tight text-lg">SketchRender</span>
          </div>
          <span className="text-xs text-white/40 border border-white/10 rounded-full px-3 py-1">Beta</span>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
          Sketch to{" "}
          <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Photorealistic
          </span>{" "}
          Render
        </h1>
        <p className="text-white/50 text-lg max-w-xl mx-auto">
          Upload your architectural sketch. AI analyzes the layout and generates a stunning render in seconds.
        </p>
      </section>

      {/* Main UI */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Upload Panel */}
          <div className="space-y-4">
            <div
              className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer
                ${dragging ? "border-amber-400 bg-amber-400/5" : "border-white/20 hover:border-white/40"}
                ${preview ? "p-0" : "p-12"}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {preview ? (
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Sketch preview" className="w-full h-full object-contain bg-white/5" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-sm font-medium">Change image</span>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-4xl mb-4">🖊️</div>
                  <p className="font-medium mb-1">Drop your sketch here</p>
                  <p className="text-sm text-white/40">JPG, PNG, WebP — floor plans, hand-drawn sketches</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>

            {/* Style Picker */}
            <div>
              <label className="text-sm text-white/50 mb-2 block">Style</label>
              <div className="grid grid-cols-3 gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border
                      ${style === s
                        ? "border-amber-400 bg-amber-400/10 text-amber-400"
                        : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
                      }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!file || loading}
              className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all
                ${file && !loading
                  ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:opacity-90 active:scale-[0.98]"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Generating render…
                </span>
              ) : "Generate Render →"}
            </button>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Result Panel */}
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02] flex flex-col">
            {result ? (
              <>
                <div className="relative flex-1 aspect-video">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${result.mimeType};base64,${result.imageData}`}
                    alt="Generated render"
                    className="w-full h-full object-contain bg-black"
                  />
                </div>
                {result.analysis && (
                  <div className="p-4 border-t border-white/10">
                    <p className="text-xs text-white/40 mb-1 uppercase tracking-wider">AI Analysis</p>
                    <p className="text-sm text-white/70">{result.analysis}</p>
                  </div>
                )}
                <div className="p-4 border-t border-white/10">
                  <button
                    onClick={downloadResult}
                    className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 transition text-sm font-medium"
                  >
                    ⬇ Download Render
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-12">
                <div>
                  <div className="text-5xl mb-4 opacity-20">🏛️</div>
                  <p className="text-white/30 text-sm">Your render will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-white/10 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: "⚡", title: "< 30s", desc: "Generation time" },
              { icon: "🎨", title: "6 Styles", desc: "Design presets" },
              { icon: "📐", title: "Any sketch", desc: "Floor plans, hand-drawn" },
              { icon: "📥", title: "Free download", desc: "Full resolution" },
            ].map((f) => (
              <div key={f.title} className="p-4">
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="font-semibold">{f.title}</div>
                <div className="text-sm text-white/40">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
