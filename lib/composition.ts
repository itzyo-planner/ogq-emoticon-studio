// Composition / camera-angle / illustration-technique library used to
// diversify the 24 emoticons in an OGQ submission. OGQ reviewers regularly
// reject sets where every sticker uses the same shot framing — so each slot
// gets an explicit, distinct composition injected into its image prompt.
//
// References blended into the library:
//  - Cinematography: Dutch tilt, worm's-eye, bird's-eye, OTS, low/high angle
//  - Japanese illustration / LINE sticker conventions:
//      * バストアップ (bust-up) — waist-up frame, the LINE sticker default
//      * アオリ (aori) — worm's-eye, dynamic upward angle
//      * フカン (fukan) — bird's-eye, looking-down framing
//      * ちびキャラ (chibi) — super-deformed proportions, big head
//      * どアップ (do-up) — extreme close-up on the face / single feature
//      * 横顔 (yokogao) — profile / side view
//  - Korean Kakao / Naver OGQ sticker norms: 3/4 view, centered isometric,
//    diagonal motion, "peek-out" frames.
//  - Photography taste: macro detail, rule-of-thirds off-center, fill-frame,
//    negative-space breathing, motion blur for energy.
//
// The pool is intentionally biased toward TIGHT framings (bust-up, close-up,
// chibi full-body) because OGQ shrinks every sticker to 96×74 in the chat
// strip — wide shots become unreadable thumbnails.

export type CompositionTag =
  | 'face'
  | 'body'
  | 'wide'
  | 'dynamic'
  | 'cute'
  | 'dramatic'
  | 'quiet'
  | 'social';

export interface Composition {
  id: string;
  /** Short human label shown in UI previews. */
  label: string;
  /** Phrase injected into the image generation prompt. */
  prompt: string;
  /** Tags used to bias the distribution by theme. */
  tags: CompositionTag[];
  /** Base weight in the pool — higher = more frequent. */
  weight: number;
}

export const COMPOSITIONS: Composition[] = [
  {
    id: 'do-up',
    label: 'どアップ / Extreme close-up',
    prompt:
      'Extreme close-up framing on the face (どアップ style), filling 90% of the frame with the head and expression. Tight crop, eyes and mouth dominate.',
    tags: ['face', 'dramatic'],
    weight: 3,
  },
  {
    id: 'bust-up',
    label: 'バストアップ / Bust-up',
    prompt:
      'Bust-up framing (バストアップ): chest-up composition, head occupies upper third, shoulders visible. LINE sticker default angle.',
    tags: ['face', 'body'],
    weight: 4,
  },
  {
    id: 'chibi-full',
    label: 'ちびキャラ Full body',
    prompt:
      'Super-deformed chibi proportions (ちびキャラ): big head, small body, full body shot centered. Cute SD ratio about 1:2 head-to-body.',
    tags: ['body', 'cute'],
    weight: 3,
  },
  {
    id: 'aori',
    label: 'アオリ / Worm’s-eye low angle',
    prompt:
      'Aori (アオリ) worm’s-eye low angle: camera below the subject looking up, dramatic perspective, makes the character feel powerful or imposing.',
    tags: ['dynamic', 'dramatic'],
    weight: 2,
  },
  {
    id: 'fukan',
    label: 'フカン / Bird’s-eye high angle',
    prompt:
      'Fukan (フカン) bird’s-eye high angle: camera looking down from above, character sees up at the viewer. Conveys vulnerability or playfulness.',
    tags: ['dynamic', 'cute'],
    weight: 2,
  },
  {
    id: 'dutch-tilt',
    label: 'Dutch tilt',
    prompt:
      'Dutch tilt / canted angle: horizon rotated about 15–25 degrees, dynamic diagonal composition. Use for surprise, panic, or excitement.',
    tags: ['dynamic', 'dramatic'],
    weight: 2,
  },
  {
    id: 'yokogao',
    label: '横顔 / Side profile',
    prompt:
      'Yokogao (横顔) side profile: pure side view of the head and shoulders, silhouette-readable. Good for thoughtful, calm, or reflective beats.',
    tags: ['face', 'quiet'],
    weight: 2,
  },
  {
    id: 'three-quarter',
    label: '3/4 view',
    prompt:
      'Three-quarter view: head and torso rotated about 30 degrees off-axis, depth and personality visible. Standard friendly sticker framing.',
    tags: ['face', 'social'],
    weight: 3,
  },
  {
    id: 'peek-out',
    label: 'Peek-out frame',
    prompt:
      'Peek-out composition: only half of the character visible from an edge of the frame (peeking from a corner, behind text, or under a shape). Strong silhouette.',
    tags: ['cute', 'social'],
    weight: 2,
  },
  {
    id: 'over-shoulder',
    label: 'OTS / Over-the-shoulder',
    prompt:
      'Over-the-shoulder framing: viewer sees the back of one shoulder/head in the foreground while the character faces forward in the middle ground.',
    tags: ['social', 'dramatic'],
    weight: 1,
  },
  {
    id: 'macro-hand',
    label: 'Macro detail',
    prompt:
      'Macro detail shot focused on a single feature (one hand, one paw, single tear, blushing cheek) filling the frame. Object close-up, no full character.',
    tags: ['face', 'quiet'],
    weight: 1,
  },
  {
    id: 'motion-diagonal',
    label: 'Motion diagonal',
    prompt:
      'Dynamic diagonal motion frame: character running, jumping, or flying across the frame from corner to corner. Speed lines optional, full body in mid-action.',
    tags: ['dynamic', 'body'],
    weight: 2,
  },
  {
    id: 'top-down-flat',
    label: 'Top-down flat lay',
    prompt:
      'Top-down flat-lay perspective: camera directly above, character lying down or curled up. Symmetrical, calm, "knolling" feel.',
    tags: ['quiet', 'body'],
    weight: 1,
  },
  {
    id: 'selfie',
    label: 'Selfie POV',
    prompt:
      'Selfie POV framing: character holding a phone up in the corner of the frame, face filling most of the image, slight fish-eye perspective.',
    tags: ['social', 'face'],
    weight: 1,
  },
  {
    id: 'back-pose',
    label: '後ろ姿 / Back view',
    prompt:
      'Ushiro-sugata (後ろ姿) back view: character seen from behind, shoulders and head visible. Conveys longing, anticipation, or leaving.',
    tags: ['quiet', 'body'],
    weight: 1,
  },
  {
    id: 'two-shot',
    label: 'Two-shot',
    prompt:
      'Two-shot composition: the main character with a small prop, sidekick item, or mirror reflection — second focal point creates visual rhythm.',
    tags: ['social', 'cute'],
    weight: 1,
  },
];

const KEYWORD_AFFINITY: Array<{
  pattern: RegExp;
  boostTags: CompositionTag[];
}> = [
  // Romance / couple
  { pattern: /couple|kiss|love|커플|연인|사랑|고백|hug|hold/i, boostTags: ['face', 'social'] },
  // Office / desk life
  { pattern: /office|coffee|email|meeting|직장|회의|야근|tired/i, boostTags: ['face', 'quiet'] },
  // Energy / fitness / dance
  { pattern: /run|jump|dance|workout|gym|fitness|운동|뛰|dance/i, boostTags: ['dynamic', 'body'] },
  // Food
  { pattern: /eat|food|cook|drink|먹|음식|요리|밥/i, boostTags: ['face', 'quiet'] },
  // Cute animals
  { pattern: /puppy|kitten|cat|dog|rabbit|penguin|토끼|강아지|고양이|펭귄|아기/i, boostTags: ['cute', 'body'] },
  // Surprise / emotion peaks
  { pattern: /surprise|shock|angry|cry|sad|놀라|충격|화나|울/i, boostTags: ['dramatic', 'face'] },
  // Space / adventure
  { pattern: /space|astronaut|alien|rocket|우주/i, boostTags: ['dynamic', 'wide'] },
];

const themeBoostTags = (theme: string | undefined): Set<CompositionTag> => {
  const boosts = new Set<CompositionTag>();
  if (!theme) return boosts;
  for (const { pattern, boostTags } of KEYWORD_AFFINITY) {
    if (pattern.test(theme)) {
      boostTags.forEach((t) => boosts.add(t));
    }
  }
  return boosts;
};

const cyrb53 = (str: string, seed = 0): number => {
  // Tiny deterministic hash so the same prompt list always yields the same
  // composition plan — important for the UI preview matching what actually
  // gets sent to the image API later.
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

interface DistributeOptions {
  theme?: string;
  seed?: string;
}

export const distributeCompositions = (
  prompts: string[],
  options: DistributeOptions = {}
): Composition[] => {
  if (prompts.length === 0) return [];

  const boosts = themeBoostTags(options.theme);
  const ranked = COMPOSITIONS.map((c) => {
    const tagBoost = c.tags.reduce(
      (sum, t) => sum + (boosts.has(t) ? 2 : 0),
      0
    );
    return { comp: c, score: c.weight + tagBoost };
  });

  // Build a weighted pool of unique composition IDs.
  const pool: Composition[] = [];
  ranked.forEach(({ comp, score }) => {
    for (let i = 0; i < score; i++) pool.push(comp);
  });

  const seedStr = options.seed ?? (options.theme ?? '') + prompts.join('|');
  const baseSeed = cyrb53(seedStr);
  const result: Composition[] = new Array(prompts.length);
  const recent: string[] = [];

  for (let i = 0; i < prompts.length; i++) {
    // Per-slot hash so output is deterministic for a given prompt list.
    const slotHash = cyrb53(prompts[i] ?? '', baseSeed + i);
    let pick = pool[slotHash % pool.length];

    // Avoid placing the same composition in two consecutive slots — and try
    // to avoid 3-of-the-same in the last 5 slots.
    const conflicts = (candidate: Composition) => {
      if (candidate.id === recent[recent.length - 1]) return true;
      const last5 = recent.slice(-5);
      return last5.filter((id) => id === candidate.id).length >= 2;
    };

    let attempts = 0;
    while (attempts < 24 && conflicts(pick)) {
      pick = pool[(slotHash + ++attempts * 31) % pool.length];
    }

    // Final deterministic fallback: scan the catalogue for any composition
    // that doesn't violate the consecutive rule. Guarantees no neighbour
    // duplicates as long as |COMPOSITIONS| >= 2.
    if (conflicts(pick)) {
      for (const c of COMPOSITIONS) {
        if (c.id !== recent[recent.length - 1]) {
          pick = c;
          break;
        }
      }
    }

    result[i] = pick;
    recent.push(pick.id);
  }

  return result;
};

export const summarizeDistribution = (
  comps: Composition[]
): Array<{ label: string; count: number }> => {
  const map = new Map<string, { label: string; count: number }>();
  comps.forEach((c) => {
    const entry = map.get(c.id);
    if (entry) entry.count += 1;
    else map.set(c.id, { label: c.label, count: 1 });
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
};
