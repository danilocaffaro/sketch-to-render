# SketchRender — Sketch to Photorealistic Render

Transform architectural sketches into photorealistic renders using Gemini Vision AI.

## Features

- Upload floor plans or hand-drawn sketches (JPG, PNG, WebP)
- Gemini Vision analyzes spatial layout and architectural elements
- Gemini 2.0 Flash generates a photorealistic render
- 6 design style presets (modern, scandinavian, industrial, luxury, japandi, mid-century)
- Mobile-responsive dark UI
- One-click download of generated renders

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TailwindCSS
- **AI:** Google Gemini Vision (`gemini-1.5-flash`) + Gemini Image Gen (`gemini-2.0-flash-preview-image-generation`)
- **Deploy:** Vercel

## Setup

### 1. Clone and install

```bash
git clone https://github.com/danilocaffaro/sketch-to-render
cd sketch-to-render
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
# Edit .env.local and add your Google API key
```

Get a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey).

### 3. Run locally

```bash
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel

1. Push to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Add environment variable: `GOOGLE_API_KEY` = your key
4. Deploy ✓

## Monetization (Phase 2)

- Freemium: 3 renders/month free
- Pro: $9.99/month unlimited
- Pay-per-render: $1.99/render

## Competitors

- ReImagine Home, ArchitectGPT, HomeDesigns AI (~$15-50/month)

---

Built for issue [#86](https://github.com/danilocaffaro/team-chat-2.0/issues/86) by Adler 🦊
