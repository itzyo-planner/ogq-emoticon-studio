import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { TEXT_MODELS } from '@/constants';
import { extractJsonObject } from '@/lib/recommendationUtils';

type Provider = 'gemini' | 'openai' | 'stability' | 'codex';

interface RecommendTitleRequest {
  characterDescription: string;
  style: string;
  prompts: string[];
  exampleInput?: string;
  apiConfig?: {
    provider: Provider;
    model: string;
    apiKey: string;
  };
  textModel?: string;
}

const DEFAULT_TEXT_MODELS = {
  gemini: TEXT_MODELS.gemini[0].id,
  openai: TEXT_MODELS.openai[0].id,
};

const buildPrompt = (body: RecommendTitleRequest) => `You are a Korean OGQ emoticon product naming expert.

Return ONLY a JSON object with this shape:
{
  "characterNames": ["name1", "name2", "name3", "name4", "name5"],
  "titles": ["title1", "title2", "title3", "title4", "title5"]
}

Rules:
- Names must be short Korean-friendly character names, 2-8 characters when possible.
- Titles must be marketplace-ready Korean emoticon set titles, warm and memorable.
- Avoid copyright-like names or celebrity/brand references.
- Use the example input as taste guidance only.

Character description:
${body.characterDescription}

Art style:
${body.style}

Sticker prompts:
${JSON.stringify(body.prompts.slice(0, 24))}

Example input:
${body.exampleInput || '노란 오리 캐릭터라면 "삐약이의 말랑한 하루"처럼 짧고 귀여운 방향'}`;

async function recommendWithGemini(
  apiKey: string,
  model: string,
  prompt: string
): Promise<Record<string, unknown>> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }] },
    config: { responseMimeType: 'application/json' },
  });
  const text = response.candidates?.[0]?.content?.parts?.find((p) => p.text)
    ?.text;
  if (!text) throw new Error('Gemini returned no text');
  return extractJsonObject(text);
}

async function recommendWithOpenAI(
  apiKey: string,
  model: string,
  prompt: string
): Promise<Record<string, unknown>> {
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'Return JSON only.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no text');
  return extractJsonObject(content);
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RecommendTitleRequest;

    if (!body.characterDescription?.trim()) {
      return NextResponse.json(
        { error: '캐릭터 설명이 필요합니다.' },
        { status: 400 }
      );
    }
    if (!body.apiConfig?.apiKey) {
      return NextResponse.json(
        { error: 'API 키가 필요합니다.' },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(body);
    const provider = body.apiConfig.provider;
    let usedModel = '';
    let parsed: Record<string, unknown>;

    if (provider === 'gemini') {
      usedModel = body.textModel || DEFAULT_TEXT_MODELS.gemini;
      parsed = await recommendWithGemini(body.apiConfig.apiKey, usedModel, prompt);
    } else if (provider === 'openai') {
      usedModel = body.textModel || DEFAULT_TEXT_MODELS.openai;
      parsed = await recommendWithOpenAI(body.apiConfig.apiKey, usedModel, prompt);
    } else {
      return NextResponse.json(
        { error: '제목 추천은 Gemini 또는 OpenAI 텍스트 모델에서 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      characterNames: asStringArray(parsed.characterNames),
      titles: asStringArray(parsed.titles),
      usedModel,
    });
  } catch (error) {
    console.error('Title Recommendation Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '제목 추천에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
