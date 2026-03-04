import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
 */
function buildPrompt(
  styleHint?: string,
  mergeMode?: boolean,
  additionalContext?: string,
  floorPlanMode?: boolean,
  perspectiveAngle?: PerspectiveAngleId
): string {
  let base: string;

  if (floorPlanMode) {
    base = [
      "Generate a photorealistic humanized architectural floor plan render, top-down bird's eye view.",
      "Fully furnished with realistic furniture, rugs, plants, and decor.",
      "Include people silhouettes for scale, natural warm interior lighting.",
      "Polished wood floors, contemporary interior design.",
      "Professional real estate marketing visualization, high detail finishes.",
    ].join(" ");
  } else if (mergeMode) {
    base = [
      "Generate a photorealistic architectural 3D render integrating all provided reference sketches.",
      "Preserve consistent viewpoint and spatial layout.",
      "Create a seamless composition blending all input geometries.",
      "Faithful proportions and structural details.",
      "Professional architectural visualization.",
    ].join(" ");
  } else {
    const angleSuffix = perspectiveAngle
      ? PERSPECTIVE_ANGLES.find((a) => a.id === perspectiveAngle)?.suffix ?? ""
      : "";

    base = [
      "Generate a photorealistic architectural 3D render from this sketch.",
      angleSuffix
        ? `Use a ${angleSuffix}.`
        : "Keep the exact same viewpoint and camera angle as the input sketch.",
      "Remain faithful to the input geometry, proportions, walls, windows, doors, and rooflines.",
      "Professional architectural visualization, ultra-detailed, 4K quality.",
    ].join(" ");
  }

  const stylePart = styleHint?.trim()
    ? ` Style: ${styleHint.trim()}.`
    : floorPlanMode
    ? " Bright airy atmosphere, Scandinavian minimal style, soft shadows."
    : " Natural daylight, realistic materials, clean architectural photography.";

  const contextPart = additionalContext?.trim()
    ? ` Additional instructions: ${additionalContext.trim()}.`
    : "";

  return base + stylePart + contextPart;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_API_KEY not configured" }, { status: 500 });
  }

  let body: RenderRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    sketchDataUrl,
    additionalImages = [],
    styleHint,
    additionalContext,
    mergeMode = false,
    floorPlanMode = false,
    perspectiveAngle,
  } = body;

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
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        // @ts-expect-error — responseModalities is supported but not yet in the SDK types
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    // Build parts array: prompt + sketch + optional extra images
    const imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];

    // Primary sketch
    const [primaryHeader, primaryBase64] = sketchDataUrl.split(",");
    const primaryMime = primaryHeader.match(/:(.*?);/)?.[1] ?? "image/png";
    imageParts.push({ inlineData: { data: primaryBase64, mimeType: primaryMime } });

    // Extra images for merge mode
    if (mergeMode && additionalImages.length > 0) {
      for (const img of additionalImages.slice(0, 3)) {
        if (img.startsWith("data:image/")) {
          const [hdr, b64] = img.split(",");
          const mime = hdr.match(/:(.*?);/)?.[1] ?? "image/png";
          imageParts.push({ inlineData: { data: b64, mimeType: mime } });
        }
      }
    }

    const result = await model.generateContent([
      fullPrompt,
      ...imageParts,
    ]);

    const response = result.response;
    const candidates = response.candidates ?? [];

    // Find the generated image part
    let imageBase64: string | null = null;
    let imageMimeType = "image/png";

    for (const candidate of candidates) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          imageBase64 = part.inlineData.data;
          imageMimeType = part.inlineData.mimeType;
          break;
        }
      }
      if (imageBase64) break;
    }

    if (!imageBase64) {
      // Log response for debugging
      console.error("[render] Gemini response — no image part found:", JSON.stringify(response).slice(0, 500));
      return NextResponse.json(
        { error: "No image returned from Gemini" },
        { status: 502 }
      );
    }

    // Return as data URL so the frontend can display it directly
    const dataUrl = `data:${imageMimeType};base64,${imageBase64}`;

    return NextResponse.json({
      url: dataUrl,
      prompt: fullPrompt,
      requestId: null,
      perspectiveAngle: perspectiveAngle ?? null,
      seed: null,
    });
  } catch (err: unknown) {
    console.error("[render] Gemini error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Render failed: ${message}` }, { status: 502 });
  }
}
