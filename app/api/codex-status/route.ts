import { NextResponse } from 'next/server';
import { hasCodexAuth } from '@/lib/codexProxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  const available = hasCodexAuth();
  return NextResponse.json({
    available,
    hint: available
      ? 'Codex OAuth 세션이 감지되었습니다.'
      : 'Codex OAuth 세션을 찾을 수 없습니다. `npx @openai/codex login` 후 재시도해주세요.',
  });
}
