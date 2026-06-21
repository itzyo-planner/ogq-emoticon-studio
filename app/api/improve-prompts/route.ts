import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { TEXT_MODELS } from '@/constants';

type Provider = 'gemini' | 'openai' | 'stability';

interface ImprovePromptsRequest {
  prompts: string[];
  theme?: string;
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

function getSystemPrompt(count: number, theme?: string) {
  const themeInstruction = theme
    ? `\n7. Apply this theme/style direction to all prompts: "${theme}"`
    : '';

  return `You are an emoticon/sticker prompt improver for the OGQ Creators marketplace. You will receive ${count} prompts and rewrite them so they pass OGQ review.

The single biggest reason OGQ rejects a 24-sticker set is that every sticker uses the same camera framing. Your job is to inject explicit, varied framing tags drawn from cinematography and Japanese illustration vocabulary.

Rules:
1. Keep each prompt SHORT (4-10 words) in English.
2. Each prompt MUST start with an explicit framing tag from this vocabulary,
   and no single framing should appear more than ~4 times in ${count} prompts:

   - Bust-up (バストアップ) — chest-up, LINE-sticker default
   - Extreme close-up (どアップ) — face fills 90% of frame
   - Worm's-eye low angle (アオリ) — dramatic upward
   - Bird's-eye high angle (フカン) — looking down, vulnerable
   - Chibi full body (ちびキャラ) — SD proportions
   - Side profile (横顔), Back view (後ろ姿)
   - Dutch tilt, Over-the-shoulder, Three-quarter view
   - Selfie POV, Macro detail, Motion diagonal, Top-down flat lay, Peek-out frame

3. Match framing to the emotional beat. E.g. crying → どアップ tear; running →
   motion diagonal; confession → 横顔 side profile.
4. Add a concrete visual detail that helps illustration (a tear, a sparkle,
   pursed lips, a fist, sweat drop, etc.).
5. Preserve the original emotion/action intent — improve, don't replace.
6. Output ONLY a JSON array of ${count} improved strings, nothing else.${themeInstruction}

Example:
Input: ["Waving hello", "Crying", "Eating", "Sleeping"]
Output: [
  "Bust-up two-handed cheerful wave",
  "Extreme close-up single tear on cheek",
  "Three-quarter view munching with full cheeks",
  "Top-down flat lay curled with snot bubble"
]`;
}

async function improveWithGemini(
  apiKey: string,
  prompts: string[],
  model: string,
  theme?: string
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        { text: getSystemPrompt(prompts.length, theme) },
        { text: `Improve these ${prompts.length} prompts:\n${JSON.stringify(prompts)}` }
      ],
    },
    config: {
      responseMimeType: 'application/json',
    },
  });

  if (response.candidates && response.candidates.length > 0) {
    const textPart = response.candidates[0]?.content?.parts?.find(p => p.text);
    if (textPart?.text) {
      try {
        const parsed = JSON.parse(textPart.text);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, prompts.length);
        }
        if (parsed.prompts && Array.isArray(parsed.prompts)) {
          return parsed.prompts.slice(0, prompts.length);
        }
      } catch {
        const match = textPart.text.match(/\[[\s\S]*\]/);
        if (match) {
          const arr = JSON.parse(match[0]);
          if (Array.isArray(arr)) {
            return arr.slice(0, prompts.length);
          }
        }
      }
    }
  }

  throw new Error('Failed to parse Gemini response');
}

async function improveWithOpenAI(
  apiKey: string,
  prompts: string[],
  model: string,
  theme?: string
): Promise<string[]> {
  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: getSystemPrompt(prompts.length, theme) },
      { role: 'user', content: `Improve these ${prompts.length} prompts:\n${JSON.stringify(prompts)}` }
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (content) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, prompts.length);
      }
      if (parsed.prompts && Array.isArray(parsed.prompts)) {
        return parsed.prompts.slice(0, prompts.length);
      }
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr)) {
          return arr.slice(0, prompts.length);
        }
      }
    }
  }

  throw new Error('Failed to parse OpenAI response');
}

export async function POST(request: NextRequest) {
  try {
    const body: ImprovePromptsRequest = await request.json();
    const { prompts, theme, apiConfig, textModel } = body;

    if (!prompts || prompts.length === 0) {
      return NextResponse.json(
        { error: '개선할 프롬프트가 없습니다.' },
        { status: 400 }
      );
    }

    if (!apiConfig?.apiKey) {
      return NextResponse.json(
        { error: 'API 키가 필요합니다.' },
        { status: 400 }
      );
    }

    let improvedPrompts: string[];
    let usedModel: string;

    if (apiConfig.provider === 'gemini') {
      usedModel = textModel || DEFAULT_TEXT_MODELS.gemini;
      improvedPrompts = await improveWithGemini(apiConfig.apiKey, prompts, usedModel, theme);
    } else if (apiConfig.provider === 'openai') {
      usedModel = textModel || DEFAULT_TEXT_MODELS.openai;
      improvedPrompts = await improveWithOpenAI(apiConfig.apiKey, prompts, usedModel, theme);
    } else {
      return NextResponse.json(
        { error: 'Stability AI는 텍스트 생성을 지원하지 않습니다.' },
        { status: 400 }
      );
    }

    // Ensure we return the same number of prompts
    while (improvedPrompts.length < prompts.length) {
      improvedPrompts.push(prompts[improvedPrompts.length]);
    }

    return NextResponse.json({
      success: true,
      prompts: improvedPrompts,
      usedModel,
    });
  } catch (error) {
    console.error('Prompt Improvement Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '프롬프트 개선에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
