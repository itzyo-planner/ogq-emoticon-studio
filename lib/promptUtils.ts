// Heuristic duplicate/near-duplicate detection for emoticon prompts.
// OGQ reviewers reject sticker sets where multiple slots express the same
// emotion. This is a lightweight client-side check that runs without any
// network call — it flags slots that should be diversified before submitting.

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'with',
  'of',
  'on',
  'in',
  'at',
  'to',
  'for',
  'is',
  'as',
  'up',
  'down',
  'from',
  'into',
  'shot',
  'shots',
  'angle',
  'angles',
  'view',
  'pose',
  'close',
  'closeup',
  'full',
  'body',
  'medium',
  'wide',
  'narrow',
  'dynamic',
  'diagonal',
  'bird',
  'birds',
  'eye',
  'birdseye',
  'low',
  'high',
  'character',
  '모습',
  '캐릭터',
  '스타일',
]);

const tokenize = (prompt: string): string[] =>
  prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

export interface DuplicateGroup {
  indices: number[];
  similarity: number;
}

// Skip the duplicate scanner on UI default placeholders so the warning panel
// doesn't yell at users who haven't filled anything in yet. These look like
// "감정/동작 1", "이모티콘 #5", "Expression 12", etc.
const PLACEHOLDER_PATTERN = /^(?:감정\/?동작|이모티콘|expression|sticker|prompt)\s*#?\s*\d+\s*$/i;

const isPlaceholder = (prompt: string): boolean =>
  PLACEHOLDER_PATTERN.test(prompt.trim());

export const findDuplicatePrompts = (
  prompts: string[],
  similarityThreshold = 0.55
): DuplicateGroup[] => {
  const tokenSets = prompts.map((p) =>
    isPlaceholder(p) ? null : new Set(tokenize(p))
  );
  const visited = new Set<number>();
  const groups: DuplicateGroup[] = [];

  for (let i = 0; i < prompts.length; i++) {
    if (visited.has(i)) continue;
    const tokensI = tokenSets[i];
    if (!tokensI) continue;
    const group: number[] = [i];
    let maxSim = 0;

    for (let j = i + 1; j < prompts.length; j++) {
      if (visited.has(j)) continue;
      const tokensJ = tokenSets[j];
      if (!tokensJ) continue;
      const sim = jaccard(tokensI, tokensJ);
      if (sim >= similarityThreshold) {
        group.push(j);
        visited.add(j);
        if (sim > maxSim) maxSim = sim;
      }
    }

    if (group.length > 1) {
      groups.push({ indices: group, similarity: maxSim });
    }
  }

  return groups;
};
