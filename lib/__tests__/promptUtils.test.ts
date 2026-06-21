import { describe, expect, it } from 'vitest';
import { findDuplicatePrompts } from '../promptUtils';

describe('findDuplicatePrompts', () => {
  it('returns empty when prompts are unique', () => {
    const result = findDuplicatePrompts([
      'Waving hello cheerfully',
      'Crying tears',
      'Sleeping curled up',
    ]);
    expect(result).toEqual([]);
  });

  it('groups near-identical prompts', () => {
    const result = findDuplicatePrompts([
      'Waving hello cheerfully',
      'Cheerfully waving hello',
      'Eating lunch happily',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].indices).toEqual([0, 1]);
    expect(result[0].similarity).toBeGreaterThanOrEqual(0.55);
  });

  it('ignores camera-angle stopwords when comparing', () => {
    const result = findDuplicatePrompts([
      'Full body waving hello',
      'Close-up waving hello',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].indices).toEqual([0, 1]);
  });

  it('handles empty prompts gracefully', () => {
    const result = findDuplicatePrompts(['', '', 'Sleeping']);
    // Two empty prompts collapse to identical empty token sets, treated as duplicates.
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('handles Korean tokens', () => {
    const result = findDuplicatePrompts([
      '커피 마시는 모습',
      '커피 마시는 캐릭터',
      '잠자는 모습',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].indices).toEqual([0, 1]);
  });

  it('respects custom similarity threshold', () => {
    const prompts = ['Drinking coffee tired', 'Drinking tea morning'];
    const loose = findDuplicatePrompts(prompts, 0.15);
    const strict = findDuplicatePrompts(prompts, 0.9);
    expect(loose.length).toBeGreaterThan(strict.length);
  });

  it('ignores default placeholder prompts', () => {
    const placeholders = [
      '감정/동작 1',
      '감정/동작 2',
      '감정/동작 3',
      'Expression 4',
      'Sticker 5',
      '이모티콘 #6',
    ];
    expect(findDuplicatePrompts(placeholders)).toEqual([]);
  });

  it('detects collisions among real prompts even when placeholders are mixed in', () => {
    const result = findDuplicatePrompts([
      '감정/동작 1',
      'waving hello cheerfully',
      'cheerfully waving hello',
      '감정/동작 4',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].indices).toEqual([1, 2]);
  });
});
