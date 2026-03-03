import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { fal } from "@fal-ai/client";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
fal.config({ credentials: process.env.FAL_KEY });

async function analyzeSketch(base64: string, mimeType: string, style: string, spaceType: string) {
  const visionModel = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    safetySettings: [{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE }],
  });

  const result = await visionModel.generateContent([
    { inlineData: { data: base64, mimeType: mimeType as "image/jpeg"|"image/png"|"image/webp" } },
    `You are an expert architectural sketch interpreter. Analyze this ${spaceType} sketch or drawing.
Describe spatial layout, architectural elements, furniture, lighting, and atmosphere.
Generate a highly detailed photorealistic render prompt for a ${style} ${spaceType}. 3-4 sentences, 8K quality, professional architectural visualization.
Format as JSON: {"analysis":"brief analysis","renderPrompt":"detailed prompt"}`,
  ]);

  try {
    const match = result.response.text().match(/\{[\s\S]*\}/);
    if (match) {
      const p = JSON.parse(match[0]);
      return { analysis: p.analysis || "", renderPrompt: p.renderPrompt || "" };
    }
  } catch {}
  return {
    analysis: "Sketch analyzed successfully.",
    renderPrompt: `Photorealistic architectural render, ${style} ${spaceType}, professional visualization, 8K quality, dramatic lighting`,
  };
}

async function generateWithFlux(prompt: string) {
  const result = await fal.subscribe("fal-ai/flux/dev", {
    input: {
      prompt: prompt + ", architectural visualization, photorealistic, professional render, 8K, ultra detailed",
      image_size: "landscape_16_9",
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: false,
    },
  }) as unknown as { images: Array<{ url: string; content_type: string }> };

  const res = await fetch(result.images[0].url);
  const buf = await res.arrayBuffer();
  return { imageData: Buffer.from(buf).toString("base64"), mimeType: result.images[0].content_type || "image/jpeg" };
}

async function generateWithGemini(prompt: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-preview-image-generation" });
  const imageResult = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt + ", architectural visualization, photorealistic" }] }],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] } as any,
  });
  const parts = imageResult.response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) return { imageData: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
  }
  throw new Error("Image generation failed.");
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const style = (formData.get("style") as string) || "modern interior";
    const spaceType = (formData.get("spaceType") as string) || "interior";
    const model = (formData.get("model") as string) || "flux";

    const files = formData.getAll("images") as File[];
    const single = formData.get("image") as File | null;
    const allFiles = files.length > 0 ? files : single ? [single] : [];

    if (allFiles.length === 0) return NextResponse.json({ error: "No image provided" }, { status: 400 });

    const results = await Promise.all(allFiles.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const { analysis, renderPrompt } = await analyzeSketch(base64, file.type, style, spaceType);

      let imageData: string, mimeType: string, modelUsed: string;
      if (model === "flux" && process.env.FAL_KEY) {
        const r = await generateWithFlux(renderPrompt);
        imageData = r.imageData; mimeType = r.mimeType; modelUsed = "Flux (fal.ai)";
      } else {
        const r = await generateWithGemini(renderPrompt);
        imageData = r.imageData; mimeType = r.mimeType; modelUsed = "Gemini 2.0 Flash";
      }
      return { imageData, mimeType, analysis, renderPrompt, modelUsed, fileName: file.name };
    }));

    return NextResponse.json(results.length === 1 ? results[0] : { results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("Render error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const maxDuration = 120;
