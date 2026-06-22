import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface GenerateNamesRequest {
  apiKey: string;
  provider: string;
  model: string;
  characterDescription: string;
  style: string;
  exampleInput?: string;
}

interface NamesResult {
  titles: string[];
  names: string[];
}

async function generateNamesWithGemini(
  apiKey: string,
  model: string,
  characterDescription: string,
  style: string
): Promise<NamesResult> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `OGQ 이모티콘 스티커의 제목 5개와 캐릭터 이름 5개를 추천해주세요. 캐릭터: ${characterDescription}. 스타일: ${style}. 제목은 귀엽고 간결하게, 캐릭터 이름은 개성 있고 기억하기 쉽게. 응답은 반드시 JSON으로: {"titles": [...], "names": [...]}`;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Gemini response');
  }
  const parsed = JSON.parse(jsonMatch[0]) as NamesResult;
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateNamesRequest = await request.json();
    const { apiKey, provider, model, characterDescription, style } = body;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Missing API key' }, { status: 400 });
    }
    if (!characterDescription || !style) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    let result: NamesResult;

    if (provider === 'gemini') {
      result = await generateNamesWithGemini(apiKey, model || 'gemini-2.5-flash', characterDescription, style);
    } else {
      // Default to Gemini gemini-2.5-flash regardless of provider
      result = await generateNamesWithGemini(apiKey, 'gemini-2.5-flash', characterDescription, style);
    }

    return NextResponse.json({ success: true, titles: result.titles, names: result.names });
  } catch (error) {
    console.error('Generate Names Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate names' },
      { status: 500 }
    );
  }
}
