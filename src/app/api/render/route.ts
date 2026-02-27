import { NextRequest, NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File;
    const style = (formData.get("style") as string) || "modern interior";

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";

    // Step 1: Analyze sketch with Gemini Vision
    const visionModel = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });

    const analysisResult = await visionModel.generateContent([
      {
        inlineData: {
          data: base64,
          mimeType,
        },
      },
      `You are an expert architectural sketch interpreter. Analyze this architectural sketch or floor plan drawing.
Describe in precise detail:
1. Room layout and spatial organization
2. Architectural elements (windows, doors, walls, columns)
3. Furniture placement and types
4. Lighting sources and openings
5. Overall style and atmosphere

Then generate a highly detailed, photorealistic render prompt for an AI image generator that would produce a stunning ${style} render of this space. The prompt should be 3-4 sentences, photorealistic, 8k quality, professional architectural visualization.

Format your response as JSON:
{
  "analysis": "brief spatial analysis",
  "renderPrompt": "the detailed image generation prompt"
}`,
    ]);

    const analysisText = analysisResult.response.text();
    let renderPrompt = "";
    let analysis = "";

    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        renderPrompt = parsed.renderPrompt;
        analysis = parsed.analysis;
      }
    } catch {
      renderPrompt = `Photorealistic architectural render, ${style}, professional interior design visualization, 8K quality, dramatic lighting, high detail`;
      analysis = "Sketch analyzed successfully.";
    }

    // Step 2: Generate render with Gemini image generation
    const imageModel = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-preview-image-generation",
    });

    const imageResult = await imageModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: renderPrompt + ", architectural visualization, photorealistic, professional render" }],
        },
      ],
      generationConfig: {
        // @ts-ignore - imagen config
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    const parts = imageResult.response.candidates?.[0]?.content?.parts || [];
    let imageData = "";
    let imageMimeType = "image/png";

    for (const part of parts) {
      if (part.inlineData) {
        imageData = part.inlineData.data;
        imageMimeType = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!imageData) {
      return NextResponse.json(
        { error: "Image generation failed. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageData,
      mimeType: imageMimeType,
      analysis,
      renderPrompt,
    });
  } catch (err: unknown) {
    console.error("Render error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const maxDuration = 60;
