"use client";

import { useState, useRef, useCallback } from "react";

const STYLES = [
  "modern minimalist",
  "scandinavian",
  "industrial loft",
  "luxury contemporary",
  "japandi zen",
  "mid-century modern",
  "rustic warm",
  "brutalist concrete",
];

const SPACE_TYPES = [
  { value: "interior living room", label: "Living Room" },
  { value: "interior bedroom", label: "Bedroom" },
  { value: "interior kitchen", label: "Kitchen" },
  { value: "interior office", label: "Office" },
  { value: "exterior facade", label: "Facade / Exterior" },
  { value: "floor plan visualization", label: "Floor Plan" },
  { value: "bathroom interior", label: "Bathroom" },
  { value: "commercial space", label: "Commercial" },
];

type RenderResult = {
  imageData: string;
  mimeType: string;
  analysis: string;
  renderPrompt: string;
  modelUsed: string;
  fileName?: string;
  originalPreview?: string;
};

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [results, setResults] = useState<RenderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState(STYLES[0]);
  const [spaceType, setSpaceType] = useState(SPACE_TYPES[0].value);
  const [model, setModel] = useState<"flux" | "gemini">("flux");
  const [dragging, setDragging] = useState(false);
  const [activeResult, setActiveResult] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(f => f.type.match(/image\/(jpeg|png|webp)/));
    if (valid.length === 0) { setError("Please upload JPG, PNG or WebP images."); return; }
    const combined = [...files, ...valid].slice(0, 5);
    setFiles(combined);
    setError(null);
    setResults([]);
    const readers = combined.map(f => new Promise<string>(resolve => {
      const r = new FileReader();
      r.onload = e => resolve(e.target?.result as string);
      r.readAsDataURL(f);
    }));
    Promise.all(readers).then(setPreviews);
  }, [files]);

  const removeFile = (i: number) => {
    setFiles(f => f.filter((_, idx) => idx !== i));
    setPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const processingResults: RenderResult[] = [];

      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("image", files[i]);
        fd.append("style", style);
        fd.append("spaceType", spaceType);
        fd.append("model", model);

        const res = await fetch("/api/render", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        processingResults.push({ ...data, originalPreview: previews[i] });
        setResults([...processingResults]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = (result: RenderResult, index: number) => {
    const a = document.createElement("a");
    a.href = `data:${result.mimeType};base64,${result.imageData}`;
    a.download = `render-${index + 1}-${Date.now()}.png`;
    a.click();
  };

  const downloadAll = () => results.forEach((r, i) => setTimeout(() => downloadResult(r, i), i * 300));

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4 sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-black font-bold text-base shadow-lg shadow-amber-500/20">S</div>
            <div>
              <span className="font-semibold tracking-tight text-base">SketchRender</span>
              <span className="text-white/30 text-xs ml-2">by Caffaro</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40 border border-white/10 rounded-full px-3 py-1">Beta</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-14 pb-10 text-center">
        <p className="text-xs font-medium text-amber-400/80 uppercase tracking-widest mb-4">AI Architectural Visualization</p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5 leading-tight">
          Sketch to{" "}
          <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            Photorealistic
          </span>{" "}
          Render
        </h1>
        <p className="text-white/40 text-lg max-w-2xl mx-auto leading-relaxed">
          Upload floor plans, hand-drawn sketches, or 3D perspectives.<br />
          AI analyzes your design and generates stunning renders in seconds.
        </p>
        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-white/30">
          <span>⚡ &lt;30 seconds</span>
          <span>·</span>
          <span>📐 Any sketch type</span>
          <span>·</span>
          <span>🎨 8 style presets</span>
          <span>·</span>
          <span>📥 Free download</span>
        </div>
      </section>

      {/* Main UI */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Controls */}
          <div className="space-y-5">
            {/* Upload Zone */}
            <div
              className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer min-h-[200px]
                ${dragging ? "border-amber-400 bg-amber-400/5" : "border-white/15 hover:border-white/30"}
                ${previews.length > 0 ? "p-4" : "p-10"}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => previews.length < 5 && fileInputRef.current?.click()}
            >
              {previews.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {previews.map((p, i) => (
                      <div key={i} className="relative group rounded-xl overflow-hidden aspect-video bg-white/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p} alt="Sketch" className="w-full h-full object-cover" />
                        <button
                          onClick={e => { e.stopPropagation(); removeFile(i); }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >×</button>
                      </div>
                    ))}
                    {previews.length < 5 && (
                      <div className="rounded-xl border border-dashed border-white/20 aspect-video flex items-center justify-center text-white/30 text-xs hover:border-white/40 transition-colors">
                        + Add more
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-white/30 text-center">{previews.length}/5 sketches · drag & drop to add more</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-5xl mb-4">🖊️</div>
                  <p className="font-medium mb-1 text-white/80">Drop your sketches here</p>
                  <p className="text-sm text-white/30 mb-2">Floor plans · Hand-drawn · 3D sketches · Photos</p>
                  <p className="text-xs text-white/20">JPG, PNG, WebP · Up to 5 files</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={e => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {/* Space Type */}
            <div>
              <label className="text-xs text-white/40 mb-2 block uppercase tracking-wider">Space Type</label>
              <div className="grid grid-cols-4 gap-2">
                {SPACE_TYPES.map(s => (
                  <button key={s.value} onClick={() => setSpaceType(s.value)}
                    className={`px-2 py-2 rounded-xl text-xs font-medium transition-all border text-center
                      ${spaceType === s.value ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div>
              <label className="text-xs text-white/40 mb-2 block uppercase tracking-wider">Style</label>
              <div className="grid grid-cols-4 gap-2">
                {STYLES.map(s => (
                  <button key={s} onClick={() => setStyle(s)}
                    className={`px-2 py-2 rounded-xl text-xs font-medium transition-all border text-center
                      ${style === s ? "border-amber-400 bg-amber-400/10 text-amber-400" : "border-white/10 text-white/40 hover:border-white/25 hover:text-white/60"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selector */}
            <div>
              <label className="text-xs text-white/40 mb-2 block uppercase tracking-wider">AI Model</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setModel("flux")}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left
                    ${model === "flux" ? "border-amber-400 bg-amber-400/8" : "border-white/10 hover:border-white/20"}`}>
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 transition-all ${model === "flux" ? "border-amber-400 bg-amber-400" : "border-white/30"}`} />
                  <div>
                    <div className={`text-sm font-semibold ${model === "flux" ? "text-amber-400" : "text-white/80"}`}>Flux <span className="text-xs font-normal opacity-60">via fal.ai</span></div>
                    <div className="text-xs text-white/30 mt-0.5">Higher quality · Photorealistic</div>
                  </div>
                </button>
                <button onClick={() => setModel("gemini")}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all text-left
                    ${model === "gemini" ? "border-amber-400 bg-amber-400/8" : "border-white/10 hover:border-white/20"}`}>
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 transition-all ${model === "gemini" ? "border-amber-400 bg-amber-400" : "border-white/30"}`} />
                  <div>
                    <div className={`text-sm font-semibold ${model === "gemini" ? "text-amber-400" : "text-white/80"}`}>Gemini <span className="text-xs font-normal opacity-60">2.0 Flash</span></div>
                    <div className="text-xs text-white/30 mt-0.5">Faster · Lower cost</div>
                  </div>
                </button>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={files.length === 0 || loading}
              className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all
                ${files.length > 0 && !loading
                  ? "bg-gradient-to-r from-amber-400 to-orange-500 text-black hover:opacity-90 active:scale-[0.98] shadow-lg shadow-amber-500/20"
                  : "bg-white/8 text-white/25 cursor-not-allowed"}`}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Generating {results.length > 0 ? `${results.length}/${files.length}` : ""}…
                </span>
              ) : `Generate ${files.length > 1 ? `${files.length} Renders` : "Render"} →`}
            </button>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div className="space-y-4">
            {results.length > 0 ? (
              <>
                {results.length > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/50">{results.length} render{results.length > 1 ? "s" : ""} generated</p>
                    <button onClick={downloadAll}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 transition text-white/60 border border-white/10">
                      ⬇ Download All
                    </button>
                  </div>
                )}
                <div className={`grid gap-4 ${results.length === 1 ? "grid-cols-1" : "grid-cols-1"}`}>
                  {results.map((result, i) => (
                    <div key={i} className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
                      <div className="grid grid-cols-2 gap-0">
                        {result.originalPreview && (
                          <div className="relative aspect-video border-r border-white/8">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={result.originalPreview} alt="Original" className="w-full h-full object-cover opacity-60" />
                            <div className="absolute bottom-2 left-2">
                              <span className="text-xs bg-black/60 px-2 py-0.5 rounded text-white/50">Original</span>
                            </div>
                          </div>
                        )}
                        <div className="relative aspect-video">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`data:${result.mimeType};base64,${result.imageData}`} alt="Render" className="w-full h-full object-cover" />
                          <div className="absolute bottom-2 right-2">
                            <span className="text-xs bg-black/60 px-2 py-0.5 rounded text-amber-400/80">Render</span>
                          </div>
                        </div>
                      </div>
                      {result.analysis && (
                        <div className="px-4 py-3 border-t border-white/8">
                          <p className="text-xs text-white/25 mb-1 uppercase tracking-wider">AI Analysis · {result.modelUsed}</p>
                          <p className="text-sm text-white/55 leading-relaxed">{result.analysis}</p>
                        </div>
                      )}
                      <div className="px-4 py-3 border-t border-white/8">
                        <button onClick={() => downloadResult(result, i)}
                          className="w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/12 transition text-sm font-medium text-white/70">
                          ⬇ Download Render {results.length > 1 ? `#${i + 1}` : ""}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-white/8 h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 bg-white/[0.015]">
                <div className="text-6xl mb-5 opacity-15">🏛️</div>
                <p className="text-white/20 text-sm mb-2">Your render will appear here</p>
                <p className="text-white/12 text-xs">Upload a sketch and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-white/20 text-xs">SketchRender · AI Architectural Visualization · Powered by Flux & Gemini</p>
        </div>
      </footer>
    </main>
  );
}
