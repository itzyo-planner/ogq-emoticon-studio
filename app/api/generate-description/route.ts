import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface GenerateDescriptionRequest {
  apiKey: string;
  provider: string;
  model: string;
  characterDescription: string;
  style: string;
  tone?: string;
  exampleInput?: string;
}

interface DescriptionResult {
  description: string;
  tags: string[];
}

async function generateDescriptionWithGemini(
  apiKey: string,
  model: string,
  characterDescription: string,
  style: string,
  tone?: string
): Promise<DescriptionResult> {
  const ai = new GoogleGenAI({ apiKey });

  const resolvedTone = tone || '친근하고 귀엽게';
  const prompt = `OGQ 이모티콘 스티커 제출용 설명을 130~155자로 작성해주세요. 캐릭터: ${characterDescription}. 스타일: ${style}. 톤: ${resolvedTone}. 태그도 15개 (# 없이 단어만). 응답 JSON: {"description": "...", "tags": [...]}`;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Gemini response');
  }
  const parsed = JSON.parse(jsonMatch[0]) as DescriptionResult;
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateDescriptionRequest = await request.json();
    const { apiKey, provider, model, characterDescription, style, tone } = body;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Missing API key' }, { status: 400 });
    }
    if (!characterDescription || !style) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    let result: DescriptionResult;

    if (provider === 'gemini') {
      result = await generateDescriptionWithGemini(apiKey, model || 'gemini-2.5-flash', characterDescription, style, tone);
    } else {
      // Default to Gemini gemini-2.5-flash regardless of provider
      result = await generateDescriptionWithGemini(apiKey, 'gemini-2.5-flash', characterDescription, style, tone);
    }

    return NextResponse.json({ success: true, description: result.description, tags: result.tags });
  } catch (error) {
    console.error('Generate Description Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate description' },
      { status: 500 }
    );
  }
}
