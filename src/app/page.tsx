'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

type RenderStyle = 'photorealistic' | 'watercolor' | 'sketch_enhanced' | 'cinematic';

interface RenderResult {
  url: string;
  prompt: string;
  requestId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STYLE_OPTIONS: { id: RenderStyle; label: string; icon: string; desc: string }[] = [
  { id: 'photorealistic', label: 'Photorealistic', icon: '📸', desc: '4K render, dramatic lighting' },
  { id: 'cinematic',      label: 'Cinematic',      icon: '🎬', desc: 'Golden hour, film look' },
  { id: 'watercolor',     label: 'Watercolor',     icon: '🎨', desc: 'Artistic presentation' },
  { id: 'sketch_enhanced',label: 'Enhanced Sketch',icon: '✏️', desc: 'Detailed linework' },
];

const EXAMPLE_PROMPTS = [
  'Modern minimalist house exterior, white concrete, large windows',
  'Contemporary office building facade, glass curtain wall',
  'Open-plan living room with floor-to-ceiling windows',
  'Luxury penthouse terrace with pool and city view',
  'Industrial loft interior with exposed brick and steel beams',
];

// ─── Drawing Canvas ───────────────────────────────────────────────────────────

interface DrawingCanvasProps {
  onSketchChange: (dataUrl: string | null) => void;
}

function DrawingCanvas({ onSketchChange }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState(3);
  const [hasDrawing, setHasDrawing] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    e.preventDefault();

    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawing(true);
    onSketchChange(canvas.toDataURL('image/png'));
  };

  const stopDraw = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    onSketchChange(null);
  }, [onSketchChange]);

  // Initialize canvas with white background
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs text-white/40">Brush</label>
          <input
            type="range" min={1} max={12} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-24 accent-indigo-500"
          />
          <span className="text-xs text-white/40 w-3">{brushSize}</span>
        </div>
        <button
          onClick={clearCanvas}
          disabled={!hasDrawing}
          className="text-xs text-white/30 hover:text-red-400 transition-colors disabled:opacity-20 flex items-center gap-1"
        >
          🗑 Clear
        </button>
      </div>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-white/10">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className="canvas-area w-full bg-white"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
        {!hasDrawing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-slate-400">
              <p className="text-4xl mb-2">✏️</p>
              <p className="text-sm font-medium">Draw your architectural sketch here</p>
              <p className="text-xs mt-1 opacity-60">Walls, windows, doors, rooflines...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── File Upload ──────────────────────────────────────────────────────────────

interface FileUploadProps {
  onUpload: (dataUrl: string) => void;
}

function FileUpload({ onUpload }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => onUpload(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        dragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <p className="text-3xl mb-2">📎</p>
      <p className="text-sm text-white/60">Drop sketch image here or <span className="text-indigo-400">browse</span></p>
      <p className="text-xs text-white/30 mt-1">JPG, PNG, WebP — hand-drawn or scanned sketches</p>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function SketchToRender() {
  const [inputMode, setInputMode] = useState<'draw' | 'upload'>('draw');
  const [sketchDataUrl, setSketchDataUrl] = useState<string | null>(null);
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<RenderStyle>('photorealistic');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<RenderResult[]>([]);

  const activeSketch = inputMode === 'draw' ? sketchDataUrl : uploadedDataUrl;

  const handleRender = async () => {
    if (!activeSketch || !prompt.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sketchDataUrl: activeSketch, prompt: prompt.trim(), style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
      setHistory(prev => [data, ...prev].slice(0, 6));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Render failed');
    } finally {
      setLoading(false);
    }
  };

  const canRender = !!activeSketch && !!prompt.trim() && !loading;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="glass border-b border-white/[0.06] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏛️</span>
            <div>
              <h1 className="text-white font-bold text-sm leading-none">Sketch to Render</h1>
              <p className="text-white/30 text-[10px] mt-0.5">AI Architectural Visualization</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Powered by FLUX + ControlNet
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── LEFT: Input panel ── */}
        <div className="space-y-6">
          {/* Mode toggle */}
          <div className="glass rounded-2xl p-1 flex gap-1">
            {(['draw', 'upload'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                  inputMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {mode === 'draw' ? '✏️ Draw' : '📎 Upload'}
              </button>
            ))}
          </div>

          {/* Canvas / Upload */}
          <div className="glass rounded-2xl p-4">
            {inputMode === 'draw' ? (
              <DrawingCanvas onSketchChange={setSketchDataUrl} />
            ) : (
              <div className="space-y-3">
                <FileUpload onUpload={setUploadedDataUrl} />
                {uploadedDataUrl && (
                  <div className="relative rounded-xl overflow-hidden border border-white/10">
                    <Image
                      src={uploadedDataUrl}
                      alt="Uploaded sketch"
                      width={800}
                      height={500}
                      className="w-full object-contain max-h-64 bg-white"
                      unoptimized
                    />
                    <button
                      onClick={() => setUploadedDataUrl(null)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-red-500/80 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <label className="text-xs text-white/40 uppercase tracking-widest font-semibold">
              Describe the render
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Modern minimalist house with large windows, surrounded by trees..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all"
            />
            {/* Example prompts */}
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPrompt(p)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-all truncate max-w-[200px]"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Style selector */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <label className="text-xs text-white/40 uppercase tracking-widest font-semibold">
              Render style
            </label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    style === s.id
                      ? 'border-indigo-500/60 bg-indigo-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <span className="text-lg block mb-1">{s.icon}</span>
                  <p className="text-xs font-semibold text-white/90">{s.label}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleRender}
            disabled={!canRender}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${
              canRender
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 active:scale-[0.98]'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                </svg>
                Rendering... (~15s)
              </span>
            ) : (
              '✨ Generate Render'
            )}
          </button>

          {error && (
            <div className="glass rounded-xl p-3 border-l-4 border-red-500/60 text-red-400 text-sm">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* ── RIGHT: Output panel ── */}
        <div className="space-y-6">
          {/* Main result */}
          <div className="glass rounded-2xl p-4 min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-white/40 uppercase tracking-widest font-semibold">
                Result
              </h2>
              {result && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download="render.jpg"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  ⬇ Download
                </a>
              )}
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                  <p className="text-white/40 text-sm">FLUX is rendering your sketch...</p>
                  <p className="text-white/20 text-xs">ControlNet is analyzing geometry</p>
                </div>
              </div>
            ) : result ? (
              <div className="flex-1 flex flex-col gap-3">
                <div className="relative rounded-xl overflow-hidden flex-1">
                  <Image
                    src={result.url}
                    alt="AI Render"
                    width={1280}
                    height={800}
                    className="w-full h-full object-cover rounded-xl"
                    unoptimized
                    priority
                  />
                </div>
                <p className="text-[10px] text-white/20 line-clamp-2">
                  Prompt: {result.prompt}
                </p>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-white/20">
                  <p className="text-5xl mb-3">🏛️</p>
                  <p className="text-sm">Your render will appear here</p>
                  <p className="text-xs mt-1 opacity-60">Draw a sketch, add a prompt, hit Generate</p>
                </div>
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 1 && (
            <div className="glass rounded-2xl p-4 space-y-3">
              <h2 className="text-xs text-white/40 uppercase tracking-widest font-semibold">
                Recent renders
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {history.slice(1).map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setResult(r)}
                    className="rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all aspect-video"
                  >
                    <Image
                      src={r.url}
                      alt={`History render ${i + 1}`}
                      width={400}
                      height={250}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <h2 className="text-xs text-white/40 uppercase tracking-widest font-semibold">
              How it works
            </h2>
            <div className="space-y-2">
              {[
                ['1', '✏️ Draw or upload', 'Sketch walls, windows, doors, rooflines — rough lines work great'],
                ['2', '💬 Describe', 'Specify materials, style, atmosphere, environment'],
                ['3', '🎨 Choose style', 'Photorealistic, cinematic, watercolor, or enhanced sketch'],
                ['4', '✨ Generate', 'FLUX + ControlNet preserves your geometry while rendering'],
              ].map(([n, title, desc]) => (
                <div key={n} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {n}
                  </span>
                  <div>
                    <p className="text-sm text-white/80 font-medium">{title}</p>
                    <p className="text-xs text-white/30">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
