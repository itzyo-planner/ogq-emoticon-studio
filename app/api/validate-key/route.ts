import { NextRequest, NextResponse } from 'next/server';

type Provider = 'gemini' | 'openai' | 'stability' | 'codex';

interface ValidateRequest {
  provider: Provider;
  apiKey: string;
}

interface ValidateResult {
  valid: boolean;
  error?: string;
}

const validateGemini = async (apiKey: string): Promise<ValidateResult> => {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { method: 'GET' }
  );
  if (res.ok) {
    return { valid: true };
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return { valid: false, error: 'Gemini API 키가 유효하지 않거나 권한이 없습니다.' };
  }
  return { valid: false, error: `검증 실패 (HTTP ${res.status}).` };
};

const validateOpenAI = async (apiKey: string): Promise<ValidateResult> => {
  const res = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.ok) {
    return { valid: true };
  }
  if (res.status === 401) {
    return { valid: false, error: 'OpenAI API 키가 유효하지 않습니다.' };
  }
  if (res.status === 429) {
    return { valid: true };
  }
  return { valid: false, error: `검증 실패 (HTTP ${res.status}).` };
};

const validateStability = async (apiKey: string): Promise<ValidateResult> => {
  const res = await fetch('https://api.stability.ai/v1/user/balance', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.ok) {
    return { valid: true };
  }
  if (res.status === 401 || res.status === 403) {
    return { valid: false, error: 'Stability AI 키가 유효하지 않습니다.' };
  }
  return { valid: false, error: `검증 실패 (HTTP ${res.status}).` };
};

export async function POST(request: NextRequest) {
  try {
    const body: ValidateRequest = await request.json();
    const { provider, apiKey } = body;

    if (!provider) {
      return NextResponse.json(
        { valid: false, error: 'Provider 누락' },
        { status: 400 }
      );
    }

    if (provider === 'codex') {
      return NextResponse.json({ valid: true });
    }

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        { valid: false, error: 'API 키가 비어 있습니다.' },
        { status: 400 }
      );
    }

    let result: ValidateResult;
    switch (provider) {
      case 'gemini':
        result = await validateGemini(apiKey);
        break;
      case 'openai':
        result = await validateOpenAI(apiKey);
        break;
      case 'stability':
        result = await validateStability(apiKey);
        break;
      default:
        return NextResponse.json(
          { valid: false, error: `지원하지 않는 provider: ${provider}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        valid: false,
        error:
          error instanceof Error
            ? error.message
            : '검증 중 알 수 없는 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}
