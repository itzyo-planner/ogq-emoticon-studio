import { describe, expect, it } from 'vitest';
import {
  COMPOSITIONS,
  distributeCompositions,
  summarizeDistribution,
} from '../composition';

describe('distributeCompositions', () => {
  it('returns empty for empty prompts', () => {
    expect(distributeCompositions([])).toEqual([]);
  });

  it('produces one composition per prompt', () => {
    const prompts = Array.from({ length: 24 }, (_, i) => `Prompt ${i + 1}`);
    const result = distributeCompositions(prompts);
    expect(result).toHaveLength(24);
    result.forEach((c) => {
      expect(c).toBeDefined();
      expect(c.prompt).toBeTruthy();
    });
  });

  it('avoids placing the same composition in consecutive slots', () => {
    const prompts = Array.from({ length: 24 }, (_, i) => `Prompt ${i + 1}`);
    const result = distributeCompositions(prompts);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].id).not.toBe(result[i - 1].id);
    }
  });

  it('produces diverse output across 24 slots (>= 6 unique compositions)', () => {
    const prompts = Array.from({ length: 24 }, (_, i) => `Prompt ${i + 1}`);
    const result = distributeCompositions(prompts);
    const unique = new Set(result.map((c) => c.id));
    expect(unique.size).toBeGreaterThanOrEqual(6);
  });

  it('is deterministic for the same input', () => {
    const prompts = ['hello', 'crying', 'eating', 'sleeping'];
    const a = distributeCompositions(prompts, { theme: 'office life' });
    const b = distributeCompositions(prompts, { theme: 'office life' });
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it('skews toward dynamic compositions for fitness theme', () => {
    const prompts = Array.from({ length: 24 }, (_, i) => `slot ${i}`);
    const fitness = distributeCompositions(prompts, { theme: 'fitness running gym workout' });
    const office = distributeCompositions(prompts, { theme: 'office tired meeting' });

    const countDynamic = (
      comps: ReturnType<typeof distributeCompositions>
    ) => comps.filter((c) => c.tags.includes('dynamic')).length;

    expect(countDynamic(fitness)).toBeGreaterThan(countDynamic(office));
  });

  it('skews toward face compositions for love theme', () => {
    const prompts = Array.from({ length: 24 }, (_, i) => `slot ${i}`);
    const love = distributeCompositions(prompts, { theme: 'love couple kiss' });
    const space = distributeCompositions(prompts, { theme: 'space astronaut rocket' });

    const countFace = (comps: ReturnType<typeof distributeCompositions>) =>
      comps.filter((c) => c.tags.includes('face')).length;

    expect(countFace(love)).toBeGreaterThanOrEqual(countFace(space));
  });
});

describe('COMPOSITIONS catalogue', () => {
  it('includes Japanese illustration terms', () => {
    const labels = COMPOSITIONS.map((c) => c.label).join('|');
    expect(labels).toMatch(/バストアップ|アオリ|フカン|ちびキャラ|横顔/);
  });

  it('every entry has a non-empty image prompt', () => {
    COMPOSITIONS.forEach((c) => {
      expect(c.prompt.length).toBeGreaterThan(20);
    });
  });
});

describe('summarizeDistribution', () => {
  it('counts repeated compositions correctly', () => {
    const prompts = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const dist = distributeCompositions(prompts);
    const summary = summarizeDistribution(dist);
    const total = summary.reduce((sum, s) => sum + s.count, 0);
    expect(total).toBe(12);
    expect(summary[0].count).toBeGreaterThanOrEqual(summary[summary.length - 1].count);
  });
});
