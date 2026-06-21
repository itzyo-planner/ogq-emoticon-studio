import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { TEXT_MODELS } from '@/constants';

type Provider = 'gemini' | 'openai' | 'stability';

interface GeneratePromptsRequest {
  theme: string;
  apiConfig?: {
    provider: Provider;
    model: string;
    apiKey: string;
  };
  textModel?: string;
  count?: number;
}

// Default text generation models
const DEFAULT_TEXT_MODELS = {
  gemini: TEXT_MODELS.gemini[0].id,
  openai: TEXT_MODELS.openai[0].id,
};

function getSystemPrompt(count: number) {
  return `You are an emoticon/sticker prompt generator for the OGQ Creators marketplace (a major Korean sticker store, similar audience to LINE/Kakao). Given a theme or concept, generate exactly ${count} unique prompts for emoticon expressions and actions that maximize OGQ approval probability.

OGQ rejection drivers to avoid:
- Same camera angle on every sticker (most common rejection reason)
- Repeated emotions / overlapping concepts
- Cropped or unreadable faces at 96x74 thumbnail size
- Generic poses that look mass-produced

Rules:
1. Each prompt is SHORT (4-10 words) in English.
2. Each prompt describes ONE specific emotion, micro-action, or beat. No vague "feeling good".
3. Across the ${count} prompts, cover at least 8 distinct emotional registers
   (joy / sadness / anger / shock / fatigue / love / shyness / pride / fear /
    excitement / boredom / curiosity / smugness / panic / serenity).
4. EVERY prompt must lead with an explicit framing tag drawn from this vocabulary
   (mix freely, no angle should appear more than ~4 times in 24 prompts):

   Japanese / illustration:
   - "Bust-up (バストアップ)" — chest-up, LINE sticker default
   - "Extreme close-up (どアップ)" — face fills 90% of frame
   - "Worm's-eye low angle (アオリ)" — power, dominance, awe
   - "Bird's-eye high angle (フカン)" — vulnerability, playfulness
   - "Chibi full body (ちびキャラ)" — super-deformed, big head, full body
   - "Side profile (横顔)" — quiet introspective beats
   - "Back view (後ろ姿)" — longing, departure

   Cinematography:
   - "Dutch tilt" — surprise, panic, joy explosion
   - "Over-the-shoulder" — social, conversational beats
   - "Three-quarter view" — friendly, default
   - "Selfie POV" — modern, social media energy
   - "Macro detail" — single hand, tear, blushing cheek
   - "Motion diagonal" — running, jumping, mid-air
   - "Top-down flat lay" — sleeping, curled up
   - "Peek-out frame" — character entering from edge

5. Match composition to the beat. Example: "Crying" → どアップ tear on cheek;
   "Running late" → motion diagonal speed lines; "Confession" → 横顔 side profile.

6. Output ONLY a JSON array of ${count} strings, nothing else.

Example output format:
["Bust-up cheerful wave hello", "Extreme close-up heart eyes sparkle", "Chibi full body crying tears flooding", "Dutch tilt shocked open mouth", "Worm's-eye triumphant fist pump", "Side profile sipping coffee", "Bird's-eye curled sleeping with blanket", ...]`;
}

async function generateWithGemini(
  apiKey: string,
  theme: string,
  model: string,
  count: number
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        { text: getSystemPrompt(count) },
        { text: `Theme: ${theme}\n\nGenerate ${count} emoticon prompts:` }
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
        if (Array.isArray(parsed) && parsed.length >= count) {
          return parsed.slice(0, count);
        }
        if (Array.isArray(parsed)) {
          return parsed;
        }
        if (parsed.prompts && Array.isArray(parsed.prompts)) {
          return parsed.prompts.slice(0, count);
        }
      } catch {
        const match = textPart.text.match(/\[[\s\S]*\]/);
        if (match) {
          const arr = JSON.parse(match[0]);
          if (Array.isArray(arr)) {
            return arr.slice(0, count);
          }
        }
      }
    }
  }

  throw new Error('Failed to parse Gemini response');
}

async function generateWithOpenAI(
  apiKey: string,
  theme: string,
  model: string,
  count: number
): Promise<string[]> {
  const openai = new OpenAI({ apiKey });

  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: getSystemPrompt(count) },
      { role: 'user', content: `Theme: ${theme}\n\nGenerate ${count} emoticon prompts:` }
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (content) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, count);
      }
      if (parsed.prompts && Array.isArray(parsed.prompts)) {
        return parsed.prompts.slice(0, count);
      }
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr)) {
          return arr.slice(0, count);
        }
      }
    }
  }

  throw new Error('Failed to parse OpenAI response');
}

export async function POST(request: NextRequest) {
  try {
    const body: GeneratePromptsRequest = await request.json();
    const { theme, apiConfig, textModel, count = 24 } = body;

    // Validate count (1-24)
    const validCount = Math.min(24, Math.max(1, count));

    if (!theme?.trim()) {
      return NextResponse.json(
        { error: '테마를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!apiConfig?.apiKey) {
      return NextResponse.json(
        { error: 'API 키가 필요합니다.' },
        { status: 400 }
      );
    }

    let prompts: string[];
    let usedModel: string;

    // Use text generation model based on provider
    if (apiConfig.provider === 'gemini') {
      usedModel = textModel || DEFAULT_TEXT_MODELS.gemini;
      prompts = await generateWithGemini(apiConfig.apiKey, theme, usedModel, validCount);
    } else if (apiConfig.provider === 'openai') {
      usedModel = textModel || DEFAULT_TEXT_MODELS.openai;
      prompts = await generateWithOpenAI(apiConfig.apiKey, theme, usedModel, validCount);
    } else {
      return NextResponse.json(
        { error: 'Stability AI는 텍스트 생성을 지원하지 않습니다.' },
        { status: 400 }
      );
    }

    // Ensure we have exactly the requested count of prompts
    while (prompts.length < validCount) {
      prompts.push(`Expression ${prompts.length + 1}`);
    }
    prompts = prompts.slice(0, validCount);

    return NextResponse.json({
      success: true,
      prompts,
      usedModel,
      count: validCount,
    });
  } catch (error) {
    console.error('Prompt Generation Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '프롬프트 생성에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
