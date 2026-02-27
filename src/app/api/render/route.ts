import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

// Server-side only — FAL_KEY never exposed to client
fal.config({ credentials: process.env.FAL_KEY });

export interface RenderRequest {
  /** Base64 data URL of the sketch image */
  sketchDataUrl: string;
  /** Architectural style prompt */
  prompt: string;
  /** Render style preset */
  style: "photorealistic" | "watercolor" | "sketch_enhanced" | "cinematic";
}

const STYLE_SUFFIX: Record<RenderRequest["style"], string> = {
  photorealistic:
    "photorealistic architectural render, 4K, dramatic lighting, detailed materials, glass, concrete, wood, professional photography",
  watercolor:
    "architectural watercolor illustration, soft washes, artistic, professional presentation drawing",
  sketch_enhanced:
    "architectural pencil sketch, detailed linework, professional hand-drawn illustration, technical drawing",
  cinematic:
    "cinematic architectural visualization, golden hour lighting, dramatic shadows, film photography, 35mm",
};

export async function POST(req: NextRequest) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500 });
  }

  let body: RenderRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sketchDataUrl, prompt, style = "photorealistic" } = body;

  if (!sketchDataUrl || !prompt) {
    return NextResponse.json({ error: "Missing sketchDataUrl or prompt" }, { status: 400 });
  }

  if (!sketchDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "sketchDataUrl must be a data: image URL" }, { status: 400 });
  }

  const fullPrompt = `${prompt}, ${STYLE_SUFFIX[style] ?? STYLE_SUFFIX.photorealistic}`;

  try {
    // Upload sketch to fal storage first (required for ControlNet input)
    const sketchBlob = await dataUrlToBlob(sketchDataUrl);
    const uploadedUrl = await fal.storage.upload(sketchBlob);

    const input = {
      prompt: fullPrompt,
      image_size: "landscape_16_9" as const,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: true,
      // ControlNet Union: "canny" mode detects edges from the sketch lines
      // preserving the architectural geometry while rendering photorealistically
      controlnet_unions: [
        {
          path: "alimama-creative/FLUX.1-dev-Controlnet-Union-Pro",
          controls: [
            {
              control_image_url: uploadedUrl,
              control_mode: "canny" as const,
              conditioning_scale: 0.65,
            },
          ],
        },
      ],
    };

    const result = await fal.subscribe("fal-ai/flux-general", { input });

    const images = result.data?.images;
    if (!images || images.length === 0) {
      return NextResponse.json({ error: "No images returned from fal.ai" }, { status: 502 });
    }

    return NextResponse.json({
      url: images[0].url,
      prompt: fullPrompt,
      requestId: result.requestId,
    });
  } catch (err: unknown) {
    console.error("[render] fal.ai error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Render failed: ${message}` }, { status: 502 });
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = Buffer.from(base64, "base64");
  return new Blob([binary], { type: mime });
}
