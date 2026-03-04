'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RenderResult {
  url: string;
  prompt: string;
  requestId: string;
  sourceIndex?: number; // which input image originated this result
}

// ─── Style suggestions (autocomplete) ────────────────────────────────────────

const STYLE_SUGGESTIONS = [
  'photorealistic, dramatic lighting, 4K',
  'cinematic, golden hour, film look',
  'watercolor, soft washes, artistic presentation',
  'enhanced sketch, detailed linework, technical drawing',
  'modernist, concrete and glass, minimalist',
  'warm materials, wood and stone, cozy atmosphere',
  'night view, artificial lighting, vibrant ambiance',
  'aerial perspective, bird\'s eye view',
  'overcast, soft diffused light, moodboard feel',
  'lush landscaping, tropical, green surroundings',
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
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
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

  const stopDraw = () => { isDrawing.current = false; lastPos.current = null; };

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    onSketchChange(null);
  }, [onSketchChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs text-white/40">Brush</label>
          <input type="range" min={1} max={12} value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-24 accent-indigo-500" />
          <span className="text-xs text-white/40 w-3">{brushSize}</span>
        </div>
        <button onClick={clearCanvas} disabled={!hasDrawing}
          className="text-xs text-white/30 hover:text-red-400 transition-colors disabled:opacity-20 flex items-center gap-1">
          🗑 Clear
        </button>
      </div>
      <div className="relative rounded-xl overflow-hidden border border-white/10">
        <canvas ref={canvasRef} width={800} height={500}
          className="canvas-area w-full bg-white"
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
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

// ─── Style Hint Input with autocomplete ──────────────────────────────────────

interface StyleHintInputProps {
  value: string;
  onChange: (v: string) => void;
}

function StyleHintInput({ value, onChange }: StyleHintInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = STYLE_SUGGESTIONS.filter(
    (s) => value.trim() === '' || s.toLowerCase().includes(value.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="text-xs text-white/40 uppercase tracking-widest font-semibold block mb-2">
        Style hint <span className="normal-case text-white/20 font-normal">(optional)</span>
      </label>
      <div className="relative flex items-center">
        <span className="absolute left-3 text-white/20 text-sm">✨</span>
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="e.g. golden hour, warm materials, night view..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all"
        />
        {value && (
          <button onClick={() => { onChange(''); setOpen(false); }}
            className="absolute right-3 text-white/20 hover:text-white/50 transition-colors text-xs">✕</button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full glass rounded-xl border border-white/10 shadow-xl overflow-hidden">
          {filtered.slice(0, 6).map((s) => (
            <button key={s} onMouseDown={(e) => { e.preventDefault(); onChange(s); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors border-b border-white/5 last:border-0 flex items-center gap-2">
              <span className="text-white/20">↩</span>
              <span className="truncate">{s}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Multi-image upload zone ──────────────────────────────────────────────────

interface MultiUploadProps {
  images: string[];
  onAdd: (dataUrl: string) => void;
  onRemove: (index: number) => void;
}

function MultiUpload({ images, onAdd, onRemove }: MultiUploadProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => onAdd(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    Array.from(e.dataTransfer.files).forEach(handleFile);
  };

  return (
    <div className="space-y-3">
      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-white">
              <Image src={img} alt={`Input ${i + 1}`} width={400} height={250}
                className="w-full h-full object-contain" unoptimized />
              <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] rounded px-1.5 py-0.5 font-mono">
                #{i + 1}
              </div>
              <button onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-red-500/80 transition-colors">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          dragging ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => Array.from(e.target.files ?? []).forEach(handleFile)} />
        <p className="text-2xl mb-1">{images.length > 0 ? '➕' : '📎'}</p>
        <p className="text-sm text-white/60">
          {images.length > 0
            ? <><span className="text-indigo-400">Add more images</span> or drop here</>
            : <>Drop sketch images here or <span className="text-indigo-400">browse</span></>}
        </p>
        <p className="text-xs text-white/30 mt-1">JPG, PNG, WebP — supports multiple images</p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function SketchToRender() {
  const [inputMode, setInputMode] = useState<'draw' | 'upload'>('draw');
  const [sketchDataUrl, setSketchDataUrl] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [styleHint, setStyleHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [results, setResults] = useState<RenderResult[]>([]);
  const [mergeResult, setMergeResult] = useState<RenderResult | null>(null);
  const [activeResult, setActiveResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0); // 0..uploadedImages.length when rendering multi

  const hasInput = inputMode === 'draw' ? !!sketchDataUrl : uploadedImages.length > 0;
  const isMulti = inputMode === 'upload' && uploadedImages.length > 1;
  const canRender = hasInput && !loading && !mergeLoading;

  // ── Single render (draw mode or single upload) ──

  const renderSingle = async (dataUrl: string, hint: string, sourceIndex?: number): Promise<RenderResult | null> => {
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sketchDataUrl: dataUrl, styleHint: hint.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return { ...data, sourceIndex };
  };

  // ── Handle Generate click ──

  const handleGenerate = async () => {
    if (!canRender) return;
    setLoading(true);
    setError('');
    setResults([]);
    setMergeResult(null);
    setActiveResult(null);
    setProgress(0);

    try {
      if (inputMode === 'draw') {
        const r = await renderSingle(sketchDataUrl!, styleHint);
        if (r) { setResults([r]); setActiveResult(r); }
      } else if (uploadedImages.length === 1) {
        const r = await renderSingle(uploadedImages[0], styleHint, 0);
        if (r) { setResults([r]); setActiveResult(r); }
      } else {
        // Multi-image: render one by one
        const newResults: RenderResult[] = [];
        for (let i = 0; i < uploadedImages.length; i++) {
          setProgress(i);
          const r = await renderSingle(uploadedImages[i], styleHint, i);
          if (r) {
            newResults.push(r);
            setResults([...newResults]);
            if (i === 0) setActiveResult(r);
          }
        }
        setProgress(uploadedImages.length);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Render failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Handle Merge ──

  const handleMerge = async () => {
    if (!isMulti || uploadedImages.length < 2 || mergeLoading) return;
    setMergeLoading(true);
    setError('');

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sketchDataUrl: uploadedImages[0],
          additionalImages: uploadedImages.slice(1),
          styleHint: styleHint.trim(),
          mergeMode: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const r: RenderResult = { ...data, sourceIndex: -1 };
      setMergeResult(r);
      setActiveResult(r);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Merge render failed');
    } finally {
      setMergeLoading(false);
    }
  };

  const addImage = (dataUrl: string) => setUploadedImages(prev => [...prev, dataUrl]);
  const removeImage = (i: number) => setUploadedImages(prev => prev.filter((_, idx) => idx !== i));

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
              <button key={mode} onClick={() => setInputMode(mode)}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                  inputMode === mode ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white/70'
                }`}>
                {mode === 'draw' ? '✏️ Draw' : '📎 Upload'}
              </button>
            ))}
          </div>

          {/* Canvas / Upload */}
          <div className="glass rounded-2xl p-4">
            {inputMode === 'draw' ? (
              <DrawingCanvas onSketchChange={setSketchDataUrl} />
            ) : (
              <MultiUpload images={uploadedImages} onAdd={addImage} onRemove={removeImage} />
            )}
          </div>

          {/* Style hint */}
          <div className="glass rounded-2xl p-4">
            <StyleHintInput value={styleHint} onChange={setStyleHint} />
            <p className="text-[10px] text-white/20 mt-2">
              Leave empty to auto-follow the input image geometry, angle, and details.
            </p>
          </div>

          {/* Generate button */}
          <button onClick={handleGenerate} disabled={!canRender}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-all ${
              canRender
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 active:scale-[0.98]'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                </svg>
                {isMulti
                  ? `Rendering image ${progress + 1} of ${uploadedImages.length}...`
                  : 'Rendering... (~15s)'}
              </span>
            ) : (
              <>✨ {isMulti ? `Render ${uploadedImages.length} images` : 'Generate Render'}</>
            )}
          </button>

          {/* Merge button (multi only) */}
          {isMulti && (
            <button onClick={handleMerge}
              disabled={mergeLoading || loading}
              className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all border ${
                !mergeLoading && !loading
                  ? 'border-violet-500/50 text-violet-300 hover:bg-violet-500/10 active:scale-[0.98]'
                  : 'border-white/10 text-white/20 cursor-not-allowed'
              }`}>
              {mergeLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                  </svg>
                  Merging images...
                </span>
              ) : (
                <>🔀 Generate merged render (all {uploadedImages.length} images)</>
              )}
            </button>
          )}

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
                {activeResult?.sourceIndex === -1 ? 'Merged Render' : 'Result'}
              </h2>
              {activeResult && (
                <a href={activeResult.url} target="_blank" rel="noopener noreferrer" download="render.jpg"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  ⬇ Download
                </a>
              )}
            </div>

            {(loading || mergeLoading) && !activeResult ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                  <p className="text-white/40 text-sm">FLUX is rendering your sketch...</p>
                  <p className="text-white/20 text-xs">ControlNet is analyzing geometry</p>
                </div>
              </div>
            ) : activeResult ? (
              <div className="flex-1 flex flex-col gap-3">
                <div className="relative rounded-xl overflow-hidden flex-1">
                  <Image src={activeResult.url} alt="AI Render" width={1280} height={800}
                    className="w-full h-full object-cover rounded-xl" unoptimized priority />
                  {activeResult.sourceIndex !== undefined && activeResult.sourceIndex >= 0 && (
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-xs rounded-lg px-2 py-1">
                      Image #{activeResult.sourceIndex + 1}
                    </div>
                  )}
                  {activeResult.sourceIndex === -1 && (
                    <div className="absolute top-2 left-2 bg-violet-600/80 text-white text-xs rounded-lg px-2 py-1 font-medium">
                      🔀 Merged
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-white/20">
                  <p className="text-5xl mb-3">🏛️</p>
                  <p className="text-sm">Your render will appear here</p>
                  <p className="text-xs mt-1 opacity-60">Draw or upload a sketch, then hit Generate</p>
                </div>
              </div>
            )}
          </div>

          {/* Multi-image result strip */}
          {(results.length > 1 || mergeResult) && (
            <div className="glass rounded-2xl p-4 space-y-3">
              <h2 className="text-xs text-white/40 uppercase tracking-widest font-semibold">
                All renders
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {results.map((r, i) => (
                  <button key={i} onClick={() => setActiveResult(r)}
                    className={`rounded-xl overflow-hidden border transition-all aspect-video relative ${
                      activeResult?.requestId === r.requestId
                        ? 'border-indigo-500/60 ring-1 ring-indigo-500/40'
                        : 'border-white/10 hover:border-white/30'
                    }`}>
                    <Image src={r.url} alt={`Render ${i + 1}`} width={400} height={250}
                      className="w-full h-full object-cover" unoptimized />
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] rounded px-1.5 py-0.5">
                      #{(r.sourceIndex ?? i) + 1}
                    </div>
                  </button>
                ))}
                {mergeResult && (
                  <button onClick={() => setActiveResult(mergeResult)}
                    className={`rounded-xl overflow-hidden border transition-all aspect-video relative ${
                      activeResult?.requestId === mergeResult.requestId
                        ? 'border-violet-500/60 ring-1 ring-violet-500/40'
                        : 'border-white/10 hover:border-white/30'
                    }`}>
                    <Image src={mergeResult.url} alt="Merged render" width={400} height={250}
                      className="w-full h-full object-cover" unoptimized />
                    <div className="absolute bottom-1 right-1 bg-violet-600/80 text-white text-[10px] rounded px-1.5 py-0.5 font-medium">
                      🔀 merge
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <h2 className="text-xs text-white/40 uppercase tracking-widest font-semibold">How it works</h2>
            <div className="space-y-2">
              {[
                ['1', '✏️ Draw or upload', 'Sketch walls, windows, doors, rooflines — rough lines work great. Upload multiple images for batch or merged renders.'],
                ['2', '✨ Style hint (optional)', 'Add keywords like "golden hour" or "night view". Leave empty to follow the input image geometry and angle.'],
                ['3', '✨ Generate', 'Each image is rendered individually, preserving view, angle, and geometry. With multiple images, also generate a merged render.'],
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
