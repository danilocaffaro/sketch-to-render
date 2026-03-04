import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

// Server-side only — FAL_KEY never exposed to client
fal.config({ credentials: process.env.FAL_KEY });

export interface RenderRequest {
  /** Base64 data URL of the primary sketch/image */
  sketchDataUrl: string;
  /** Optional additional images (for merge mode) */
  additionalImages?: string[];
  /** Optional free-text style hint from user (e.g. "golden hour, warm materials") */
  styleHint?: string;
  /** When true, blend all input images into a single cohesive render */
  mergeMode?: boolean;
}

/**
 * Build a geometry-first prompt that preserves the input image's viewpoint,
 * angle, proportions, and spatial relationships.
 * The style hint is appended only if provided — default stays faithful to input.
 */
function buildPrompt(styleHint?: string, mergeMode?: boolean): string {
  const base = mergeMode
    ? [
        "architectural 3D render integrating multiple reference images,",
        "preserving consistent viewpoint and spatial layout,",
        "seamless composition blending all input geometries,",
        "same perspective angle as reference images,",
        "faithful proportions and structural details,",
        "professional architectural visualization,",
      ].join(" ")
    : [
        "photorealistic architectural 3D render,",
        "exact same viewpoint and camera angle as the input image,",
        "faithful to the input geometry and spatial proportions,",
        "preserving all structural details walls windows doors rooflines,",
        "matching perspective and depth as shown in sketch,",
        "professional architectural visualization, ultra-detailed, 4K,",
      ].join(" ");

  const stylePart = styleHint?.trim()
    ? `, ${styleHint.trim()}`
    : ", natural daylight, realistic materials, clean architectural photography";

  return base + stylePart;
}

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

  const { sketchDataUrl, additionalImages = [], styleHint, mergeMode = false } = body;

  if (!sketchDataUrl) {
    return NextResponse.json({ error: "Missing sketchDataUrl" }, { status: 400 });
  }

  if (!sketchDataUrl.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "sketchDataUrl must be a data: image URL" },
      { status: 400 }
    );
  }

  const fullPrompt = buildPrompt(styleHint, mergeMode);

  try {
    // Upload primary sketch to fal storage
    const sketchBlob = await dataUrlToBlob(sketchDataUrl);
    const uploadedUrl = await fal.storage.upload(sketchBlob);

    // For merge mode, upload additional images too
    const additionalUrls: string[] = [];
    if (mergeMode && additionalImages.length > 0) {
      for (const img of additionalImages.slice(0, 3)) {
        // limit to 3 extra for perf
        if (img.startsWith("data:image/")) {
          const blob = await dataUrlToBlob(img);
          additionalUrls.push(await fal.storage.upload(blob));
        }
      }
    }

    // ControlNet conditioning scale slightly higher for merge (needs to integrate multiple sources)
    const conditioningScale = mergeMode ? 0.75 : 0.70;

    const controls: Array<{
      control_image_url: string;
      control_mode: "canny";
      conditioning_scale: number;
    }> = [
      {
        control_image_url: uploadedUrl,
        control_mode: "canny",
        conditioning_scale: conditioningScale,
      },
      // In merge mode, add extra images as additional canny controls with lower weight
      ...additionalUrls.map((url) => ({
        control_image_url: url,
        control_mode: "canny" as const,
        conditioning_scale: 0.30,
      })),
    ];

    const input = {
      prompt: fullPrompt,
      image_size: "landscape_16_9" as const,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: true,
      controlnet_unions: [
        {
          path: "alimama-creative/FLUX.1-dev-Controlnet-Union-Pro",
          controls,
        },
      ],
    };

    const result = await fal.subscribe("fal-ai/flux-general", { input });

    const images = result.data?.images;
    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "No images returned from fal.ai" },
        { status: 502 }
      );
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
