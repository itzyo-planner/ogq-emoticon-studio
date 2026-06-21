import { describe, expect, it } from 'vitest';
import { buildPrompt } from '@/lib/buildPrompt';

describe('buildPrompt', () => {
  const baseArgs = {
    character: '빨간 나비넥타이 한 노란 오리',
    scenario: 'Waving hello cheerfully',
    style: 'Sticker, Flat Vector, 2D',
  };

  it('includes the character description', () => {
    const result = buildPrompt(
      baseArgs.character,
      baseArgs.scenario,
      baseArgs.style,
      false
    );
    expect(result).toContain(baseArgs.character);
  });

  it('includes the scenario prompt as ACTION/EMOTION', () => {
    const result = buildPrompt(
      baseArgs.character,
      baseArgs.scenario,
      baseArgs.style,
      false
    );
    expect(result).toContain(baseArgs.scenario);
    expect(result).toContain('ACTION/EMOTION');
  });

  it('includes art style', () => {
    const result = buildPrompt(
      baseArgs.character,
      baseArgs.scenario,
      baseArgs.style,
      false
    );
    expect(result).toContain(baseArgs.style);
  });

  it('enforces strict no-shadow policy', () => {
    const result = buildPrompt(
      baseArgs.character,
      baseArgs.scenario,
      baseArgs.style,
      false
    );
    expect(result).toMatch(/NO SHADOW/i);
    expect(result).toMatch(/no.*drop.*shadow/i);
  });

  it('emits a negative prompt block', () => {
    const result = buildPrompt(
      baseArgs.character,
      baseArgs.scenario,
      baseArgs.style,
      false
    );
    expect(result).toContain('NEGATIVE PROMPT');
    expect(result).toContain('shadow');
    expect(result).toContain('gradient');
  });

  it('adds reference instruction only when reference image is present', () => {
    const withRef = buildPrompt(
      baseArgs.character,
      baseArgs.scenario,
      baseArgs.style,
      true
    );
    const withoutRef = buildPrompt(
      baseArgs.character,
      baseArgs.scenario,
      baseArgs.style,
      false
    );
    expect(withRef).toContain('REFERENCE IMAGE INSTRUCTION');
    expect(withoutRef).not.toContain('REFERENCE IMAGE INSTRUCTION');
  });

  it('injects the composition phrase under a FRAMING (MUST FOLLOW) directive', () => {
    const composition =
      'Worm’s-eye low angle (アオリ): dramatic upward perspective.';
    const result = buildPrompt(
      baseArgs.character,
      baseArgs.scenario,
      baseArgs.style,
      false,
      composition
    );
    expect(result).toContain('FRAMING (MUST FOLLOW)');
    expect(result).toContain(composition);
  });

  it('falls back to a default framing instruction when none provided', () => {
    const result = buildPrompt(
      baseArgs.character,
      baseArgs.scenario,
      baseArgs.style,
      false
    );
    expect(result).toMatch(/FRAMING/);
    expect(result).not.toContain('FRAMING (MUST FOLLOW)');
  });
});
