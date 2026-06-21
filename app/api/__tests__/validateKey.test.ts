import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../validate-key/route';

const makeRequest = (body: unknown): NextRequest =>
  new NextRequest('http://localhost/api/validate-key', {
    method: 'POST',
    body: JSON.stringify(body),
  });

const mockFetch = (status: number, body: unknown = {}) => {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response);
};

describe('POST /api/validate-key', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns 400 when provider is missing', async () => {
    const res = await POST(makeRequest({ apiKey: 'abc' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it('returns valid=true for codex without any key', async () => {
    const res = await POST(makeRequest({ provider: 'codex' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
  });

  it('rejects empty api key for keyed providers', async () => {
    const res = await POST(makeRequest({ provider: 'openai', apiKey: '' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it('passes Gemini validation when API responds 200', async () => {
    globalThis.fetch = mockFetch(200);
    const res = await POST(
      makeRequest({ provider: 'gemini', apiKey: 'AIza-good' })
    );
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it('fails Gemini validation on 401', async () => {
    globalThis.fetch = mockFetch(401);
    const res = await POST(
      makeRequest({ provider: 'gemini', apiKey: 'AIza-bad' })
    );
    const data = await res.json();
    expect(data.valid).toBe(false);
    expect(data.error).toMatch(/Gemini/);
  });

  it('treats OpenAI 429 (rate limit) as valid', async () => {
    globalThis.fetch = mockFetch(429);
    const res = await POST(
      makeRequest({ provider: 'openai', apiKey: 'sk-good' })
    );
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it('fails OpenAI validation on 401', async () => {
    globalThis.fetch = mockFetch(401);
    const res = await POST(
      makeRequest({ provider: 'openai', apiKey: 'sk-bad' })
    );
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it('passes Stability validation when balance endpoint returns 200', async () => {
    globalThis.fetch = mockFetch(200, { credits: 100 });
    const res = await POST(
      makeRequest({ provider: 'stability', apiKey: 'sk-stab-good' })
    );
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it('fails Stability validation on 403', async () => {
    globalThis.fetch = mockFetch(403);
    const res = await POST(
      makeRequest({ provider: 'stability', apiKey: 'sk-stab-bad' })
    );
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it('rejects unknown provider', async () => {
    const res = await POST(
      makeRequest({ provider: 'wat', apiKey: 'x' } as unknown as {
        provider: 'gemini';
        apiKey: string;
      })
    );
    expect(res.status).toBe(400);
  });
});
