import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { TEXT_MODELS } from '@/constants';
import {
  extractJsonObject,
  fitDescriptionRange,
  normalizeDescription,
  normalizeTags,
} from '@/lib/recommendationUtils';

type Provider = 'gemini' | 'openai' | 'stability' | 'codex';

interface RecommendMetadataRequest {
  characterDescription: string;
  style: string;
  prompts: string[];
  title?: string;
  tone?: string;
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

const fallbackTags = [
  '이모티콘',
  '스티커',
  '캐릭터',
  '귀여움',
  '일상',
  '감정',
  '대화',
  '손글씨',
  '힐링',
  '응원',
  '공감',
  '표정',
  '재미',
  '따뜻함',
  '메신저',
];

const buildPrompt = (body: RecommendMetadataRequest) => `You are a Korean OGQ emoticon marketplace metadata writer.

Return ONLY a JSON object with this shape:
{
  "description": "Korean description, 130-155 characters",
  "tags": ["tag1", "tag2", "... exactly 15 tags"]
}

Rules:
- Description must be Korean and 130-155 characters.
- Tags must be exactly 15 short Korean tags without #.
- Match this tone: ${body.tone || '따뜻한'}
- Use the example input as guidance only.
- Avoid unsupported claims, brand names, or celebrity references.

Title:
${body.title || ''}

Character description:
${body.characterDescription}

Art style:
${body.style}

Sticker prompts:
${JSON.stringify(body.prompts.slice(0, 24))}

Example input:
${body.exampleInput || '따뜻하고 귀여운 톤으로, 일상 대화에서 쓰기 좋은 설명과 태그'}`;

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RecommendMetadataRequest;

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
        { error: '설명/태그 추천은 Gemini 또는 OpenAI 텍스트 모델에서 사용할 수 있습니다.' },
        { status: 400 }
      );
    }

    const rawTags = Array.isArray(parsed.tags)
      ? parsed.tags.map((tag) => String(tag))
      : [];
    const tags = normalizeTags([...rawTags, ...fallbackTags]);
    const description = fitDescriptionRange(
      normalizeDescription(String(parsed.description || '')),
      `${body.characterDescription} ${body.title || ''} ${body.tone || '따뜻한'} 톤의 일상 대화용 이모티콘입니다.`
    );

    return NextResponse.json({
      success: true,
      description,
      tags,
      usedModel,
    });
  } catch (error) {
    console.error('Metadata Recommendation Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '설명과 태그 추천에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
