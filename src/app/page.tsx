'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RenderResult {
  url: string;
  prompt: string;
  requestId: string;
  sourceIndex?: number; // which input image originated this result
  perspectiveAngle?: string | null; // for multi-perspective mode
}

// ─── Perspective angle labels ─────────────────────────────────────────────────

const PERSPECTIVE_LABELS: Record<string, string> = {
  front: '⬜ Front',
  perspective: '◱ 3/4',
  aerial: '🦅 Aerial',
};


interface BeforeAfterSliderProps {
  beforeSrc: string; // sketch / input
  afterSrc: string;  // render / output
}

function BeforeAfterSlider({ beforeSrc, afterSrc }: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50); // 0..100
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = (clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setPosition((x / rect.width) * 100);
  };

  const onMouseDown = (e: React.MouseEvent) => { e.preventDefault(); setDragging(true); updatePosition(e.clientX); };
  const onMouseMove = (e: React.MouseEvent) => { if (dragging) updatePosition(e.clientX); };
  const onMouseUp = () => setDragging(false);
  const onTouchStart = (e: React.TouchEvent) => { setDragging(true); updatePosition(e.touches[0].clientX); };
  const onTouchMove = (e: React.TouchEvent) => { if (dragging) { e.preventDefault(); updatePosition(e.touches[0].clientX); } };
  const onTouchEnd = () => setDragging(false);

  useEffect(() => {
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up); };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-xl overflow-hidden select-none cursor-col-resize"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* After (render) — full width background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterSrc} alt="AI Render" className="absolute inset-0 w-full h-full object-cover" draggable={false} />

      {/* Before (sketch) — clipped to left side */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeSrc} alt="Sketch" className="absolute inset-0 bg-white" style={{ width: containerRef.current?.offsetWidth ?? '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.6)]"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      >
        {/* Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 8L2 5M5 8L2 11M5 8H1" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 8L14 5M11 8L14 11M11 8H15" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-semibold px-2 py-1 rounded-md pointer-events-none">
        SKETCH
      </div>
      <div className="absolute top-2 right-2 bg-indigo-600/80 text-white text-[10px] font-semibold px-2 py-1 rounded-md pointer-events-none">
        RENDER
      </div>
    </div>
  );
}


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
  additionalContext: string;
  onAdditionalContextChange: (v: string) => void;
}

function StyleHintInput({ value, onChange, additionalContext, onAdditionalContextChange }: StyleHintInputProps) {
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
    <div className="space-y-4">
      {/* Style hint */}
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

      {/* Additional context / adjustments */}
      <div>
        <label className="text-xs text-white/40 uppercase tracking-widest font-semibold block mb-2">
          Additional context <span className="normal-case text-white/20 font-normal">(optional)</span>
        </label>
        <textarea
          value={additionalContext}
          onChange={(e) => onAdditionalContextChange(e.target.value)}
          placeholder="e.g. add a swimming pool on the right side, remove the garage, make it a 2-story building..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/8 transition-all resize-none leading-relaxed"
        />
        <p className="text-[10px] text-white/20 mt-1.5">
          Describe adjustments or extra details to guide the render beyond what the sketch shows.
        </p>
      </div>
    </div>
  );
}

// ─── Multi-image upload zone ──────────────────────────────────────────────────

interface MultiUploadProps {
  images: string[];
  onAdd: (dataUrl: string) => void;
  onRemove: (index: number) => void;
  floorPlanMode?: boolean;
}

function MultiUpload({ images, onAdd, onRemove, floorPlanMode = false }: MultiUploadProps) {
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
        <p className="text-2xl mb-1">{images.length > 0 ? '➕' : floorPlanMode ? '📐' : '📎'}</p>
        <p className="text-sm text-white/60">
          {images.length > 0
            ? <><span className="text-indigo-400">Add more {floorPlanMode ? 'floor plans' : 'images'}</span> or drop here</>
            : floorPlanMode
              ? <>Drop your <span className="text-indigo-400">floor plan</span> here or <span className="text-indigo-400">browse</span></>
              : <>Drop sketch images here or <span className="text-indigo-400">browse</span></>}
        </p>
        <p className="text-xs text-white/30 mt-1">
          {floorPlanMode
            ? 'JPG, PNG, WebP — top-down floor plan sketch or image'
            : 'JPG, PNG, WebP — supports multiple images'}
        </p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function SketchToRender() {
  const [inputMode, setInputMode] = useState<'draw' | 'upload' | 'floorplan'>('draw');
  const [sketchDataUrl, setSketchDataUrl] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [styleHint, setStyleHint] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [multiPerspLoading, setMultiPerspLoading] = useState(false);
  const [results, setResults] = useState<RenderResult[]>([]);
  const [mergeResult, setMergeResult] = useState<RenderResult | null>(null);
  const [activeResult, setActiveResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0); // 0..uploadedImages.length when rendering multi
  const [showComparison, setShowComparison] = useState(false); // before/after slider toggle

  const hasInput = inputMode === 'draw' ? !!sketchDataUrl : uploadedImages.length > 0;
  const isMulti = inputMode === 'upload' && uploadedImages.length > 1;
  const isFloorPlan = inputMode === 'floorplan';
  const canRender = hasInput && !loading && !mergeLoading && !multiPerspLoading;

  // ── Single render (draw mode or single upload) ──

  const renderSingle = async (dataUrl: string, hint: string, context: string, sourceIndex?: number, perspectiveAngle?: string, seed?: number): Promise<RenderResult | null> => {
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sketchDataUrl: dataUrl,
        styleHint: hint.trim(),
        additionalContext: context.trim(),
        floorPlanMode: isFloorPlan,
        ...(perspectiveAngle && { perspectiveAngle }),
        ...(seed !== undefined && { seed }),
      }),
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
    setShowComparison(false);

    try {
      if (inputMode === 'draw') {
        const r = await renderSingle(sketchDataUrl!, styleHint, additionalContext);
        if (r) { setResults([r]); setActiveResult(r); }
      } else if (uploadedImages.length === 1) {
        const r = await renderSingle(uploadedImages[0], styleHint, additionalContext, 0);
        if (r) { setResults([r]); setActiveResult(r); }
      } else {
        // Multi-image: render one by one
        const newResults: RenderResult[] = [];
        for (let i = 0; i < uploadedImages.length; i++) {
          setProgress(i);
          const r = await renderSingle(uploadedImages[i], styleHint, additionalContext, i);
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
          additionalContext: additionalContext.trim(),
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

  // ── Multi-perspective: generate 3 angles from same sketch ──
  const handleMultiPerspective = async () => {
    const sourceImg = inputMode === 'draw' ? sketchDataUrl : uploadedImages[0];
    if (!sourceImg || multiPerspLoading) return;

    setMultiPerspLoading(true);
    setError('');
    setResults([]);
    setMergeResult(null);
    setActiveResult(null);
    setProgress(0);
    setShowComparison(false);

    try {
      // Fixed seed for visual consistency across angles
      const seed = Math.floor(Math.random() * 2147483647);
      const angles = ['front', 'perspective', 'aerial'] as const;
      const newResults: RenderResult[] = [];

      for (let i = 0; i < angles.length; i++) {
        setProgress(i);
        const r = await renderSingle(sourceImg, styleHint, additionalContext, i, angles[i], seed);
        if (r) {
          newResults.push(r);
          setResults([...newResults]);
          if (i === 0) setActiveResult(r);
        }
      }
      setProgress(angles.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Multi-perspective render failed');
    } finally {
      setMultiPerspLoading(false);
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
            {([
              { id: 'draw', label: '✏️ Draw' },
              { id: 'upload', label: '📎 Upload' },
              { id: 'floorplan', label: '📐 Floor Plan' },
            ] as const).map(({ id, label }) => (
              <button key={id} onClick={() => setInputMode(id)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                  inputMode === id ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white/70'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Canvas / Upload */}
          <div className="glass rounded-2xl p-4">
            {inputMode === 'draw' ? (
              <DrawingCanvas onSketchChange={setSketchDataUrl} />
            ) : inputMode === 'floorplan' ? (
              <MultiUpload images={uploadedImages} onAdd={addImage} onRemove={removeImage} floorPlanMode />
            ) : (
              <MultiUpload images={uploadedImages} onAdd={addImage} onRemove={removeImage} />
            )}
          </div>

          {/* Style hint + additional context */}
          <div className="glass rounded-2xl p-4">
            {isFloorPlan && (
              <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                <span className="text-base flex-shrink-0">📐</span>
                <div>
                  <p className="text-xs font-semibold text-indigo-300">Floor Plan Mode</p>
                  <p className="text-[11px] text-white/40 mt-0.5">AI will generate a top-down humanized view — fully furnished with people, plants, and natural lighting. Works best with clean floor plan sketches or blueprints.</p>
                </div>
              </div>
            )}
            <StyleHintInput
              value={styleHint}
              onChange={setStyleHint}
              additionalContext={additionalContext}
              onAdditionalContextChange={setAdditionalContext}
            />
            <p className="text-[10px] text-white/20 mt-2">
              {isFloorPlan
                ? 'Leave style empty for Scandinavian minimal default. Try "luxury contemporary" or "warm Brazilian style".'
                : 'Leave style empty to auto-follow the input image geometry, angle, and details.'}
            </p>
          </div>

          {/* High quality model — coming soon */}
          <div className="glass rounded-2xl p-4 opacity-60 cursor-not-allowed select-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-base">⚡</div>
                <div>
                  <p className="text-sm font-semibold text-white/70">High Quality Model</p>
                  <p className="text-xs text-white/30">Flux Pro · higher resolution · slower</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-400/70 border border-amber-400/30 rounded-full px-2.5 py-1">
                Em breve
              </span>
            </div>
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

          {/* Multi-perspective button — available in draw + single upload */}
          {!isMulti && hasInput && (
            <button onClick={handleMultiPerspective}
              disabled={multiPerspLoading || loading || mergeLoading}
              className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all border ${
                !multiPerspLoading && !loading && !mergeLoading
                  ? 'border-amber-500/50 text-amber-300 hover:bg-amber-500/10 active:scale-[0.98]'
                  : 'border-white/10 text-white/20 cursor-not-allowed'
              }`}>
              {multiPerspLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
                  </svg>
                  {progress < 3 ? `Generating angle ${progress + 1}/3...` : 'Finishing...'}
                </span>
              ) : (
                <>🔭 3 perspectives — Front · 3/4 · Aerial</>
              )}
            </button>
          )}

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
              <div className="flex items-center gap-3">
                {/* Before/After toggle — only when we have result AND a sketch/image to compare */}
                {activeResult && (sketchDataUrl || uploadedImages.length > 0) && (
                  <button
                    onClick={() => setShowComparison(v => !v)}
                    className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-all border ${
                      showComparison
                        ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300'
                        : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'
                    }`}
                  >
                    ↔ Before / After
                  </button>
                )}
                {activeResult && (
                  <a href={activeResult.url} target="_blank" rel="noopener noreferrer" download="render.jpg"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                    ⬇ Download
                  </a>
                )}
              </div>
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
                {showComparison && (sketchDataUrl || uploadedImages.length > 0) ? (
                  /* Before/After slider mode */
                  <BeforeAfterSlider
                    beforeSrc={
                      inputMode === 'draw'
                        ? (sketchDataUrl ?? '')
                        : (uploadedImages[activeResult.sourceIndex ?? 0] ?? uploadedImages[0])
                    }
                    afterSrc={activeResult.url}
                  />
                ) : (
                  /* Normal render view */
                  <div className="relative rounded-xl overflow-hidden flex-1">
                    <Image src={activeResult.url} alt="AI Render" width={1280} height={800}
                      className="w-full h-full object-cover rounded-xl" unoptimized priority />
                    {activeResult.perspectiveAngle && (
                      <div className="absolute top-2 left-2 bg-amber-600/80 text-white text-xs rounded-lg px-2 py-1 font-medium">
                        {PERSPECTIVE_LABELS[activeResult.perspectiveAngle] ?? activeResult.perspectiveAngle}
                      </div>
                    )}
                    {!activeResult.perspectiveAngle && activeResult.sourceIndex !== undefined && activeResult.sourceIndex >= 0 && (
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
                )}
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
                      {r.perspectiveAngle ? (PERSPECTIVE_LABELS[r.perspectiveAngle] ?? r.perspectiveAngle) : `#${(r.sourceIndex ?? i) + 1}`}
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
