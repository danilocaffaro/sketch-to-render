import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

// Server-side only — FAL_KEY never exposed to client
fal.config({ credentials: process.env.FAL_KEY });

// ─── Perspective angles for multi-perspective mode ────────────────────────────

export const PERSPECTIVE_ANGLES = [
  { id: "front", label: "Front View", suffix: "straight-on frontal elevation view, symmetrical composition" },
  { id: "perspective", label: "3/4 View", suffix: "three-quarter perspective view, slight angle, dynamic composition" },
  { id: "aerial", label: "Aerial View", suffix: "aerial bird's eye perspective, elevated viewpoint, 45-degree angle" },
] as const;

export type PerspectiveAngleId = typeof PERSPECTIVE_ANGLES[number]["id"];

export interface RenderRequest {
  /** Base64 data URL of the primary sketch/image */
  sketchDataUrl: string;
  /** Optional additional images (for merge mode) */
  additionalImages?: string[];
  /** Optional free-text style hint from user (e.g. "golden hour, warm materials") */
  styleHint?: string;
  /** Optional extra instructions / adjustments beyond the sketch */
  additionalContext?: string;
  /** When true, blend all input images into a single cohesive render */
  mergeMode?: boolean;
  /** When true, use floor plan humanization mode (top-down, furnished, people) */
  floorPlanMode?: boolean;
  /** When set, override the viewpoint angle for multi-perspective mode */
  perspectiveAngle?: PerspectiveAngleId;
  /** Optional seed for reproducibility (used in multi-perspective to keep style consistent) */
  seed?: number;
}

/**
 * Build a geometry-first prompt that preserves the input image's viewpoint,
 * angle, proportions, and spatial relationships.
 * The style hint is appended only if provided — default stays faithful to input.
 * additionalContext is appended at the end for extra adjustments.
 */
function buildPrompt(styleHint?: string, mergeMode?: boolean, additionalContext?: string, floorPlanMode?: boolean, perspectiveAngle?: PerspectiveAngleId): string {
  let base: string;

  if (floorPlanMode) {
    base = [
      "humanized architectural floor plan render, top-down bird's eye view,",
      "fully furnished with realistic furniture, rugs, plants, and decor,",
      "people silhouettes for scale, natural warm interior lighting,",
      "polished wood floors, contemporary interior design,",
      "photorealistic overhead view, high detail finishes,",
      "professional real estate marketing visualization,",
    ].join(" ");
  } else if (mergeMode) {
    base = [
      "architectural 3D render integrating multiple reference images,",
      "preserving consistent viewpoint and spatial layout,",
      "seamless composition blending all input geometries,",
      "same perspective angle as reference images,",
      "faithful proportions and structural details,",
      "professional architectural visualization,",
    ].join(" ");
  } else {
    const angleSuffix = perspectiveAngle
      ? PERSPECTIVE_ANGLES.find(a => a.id === perspectiveAngle)?.suffix ?? ""
      : "";

    base = [
      "photorealistic architectural 3D render,",
      angleSuffix || "exact same viewpoint and camera angle as the input image,",
      "faithful to the input geometry and spatial proportions,",
      "preserving all structural details walls windows doors rooflines,",
      perspectiveAngle ? "" : "matching perspective and depth as shown in sketch,",
      "professional architectural visualization, ultra-detailed, 4K,",
    ].filter(Boolean).join(" ");
  }

  const stylePart = styleHint?.trim()
    ? `, ${styleHint.trim()}`
    : floorPlanMode
      ? ", bright airy atmosphere, Scandinavian minimal style, soft shadows"
      : ", natural daylight, realistic materials, clean architectural photography";

  const contextPart = additionalContext?.trim()
    ? `, ${additionalContext.trim()}`
    : "";

  return base + stylePart + contextPart;
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

  const { sketchDataUrl, additionalImages = [], styleHint, additionalContext, mergeMode = false, floorPlanMode = false, perspectiveAngle, seed } = body;

  if (!sketchDataUrl) {
    return NextResponse.json({ error: "Missing sketchDataUrl" }, { status: 400 });
  }

  if (!sketchDataUrl.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "sketchDataUrl must be a data: image URL" },
      { status: 400 }
    );
  }

  const fullPrompt = buildPrompt(styleHint, mergeMode, additionalContext, floorPlanMode, perspectiveAngle);

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

    // ControlNet conditioning scale:
    // - floor plan: 0.55 (more creative freedom for humanization)
    // - merge: 0.75 (needs to integrate multiple sources)
    // - default: 0.70 (geometry-faithful)
    const conditioningScale = floorPlanMode ? 0.55 : mergeMode ? 0.75 : 0.70;

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
      // floor plan: square_hd (plans are typically square); default: landscape_16_9
      image_size: floorPlanMode ? ("square_hd" as const) : ("landscape_16_9" as const),
      num_inference_steps: 28,
      guidance_scale: floorPlanMode ? 4.5 : 3.5, // higher guidance for floor plan detail
      num_images: 1,
      enable_safety_checker: true,
      // seed: fixes style/palette consistency across multi-perspective renders
      ...(seed !== undefined && { seed }),
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
      perspectiveAngle: perspectiveAngle ?? null,
      seed: seed ?? null,
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
