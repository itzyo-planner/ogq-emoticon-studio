export const normalizeDescription = (description: string): string => {
  const normalized = description.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 155) return normalized;

  const sliced = normalized.slice(0, 155).trim();
  const lastSentenceEnd = Math.max(
    sliced.lastIndexOf('.'),
    sliced.lastIndexOf('!'),
    sliced.lastIndexOf('?'),
    sliced.lastIndexOf('。'),
    sliced.lastIndexOf('다.')
  );

  if (lastSentenceEnd >= 130) {
    return sliced.slice(0, lastSentenceEnd + 1).trim();
  }

  return sliced;
};

export const fitDescriptionRange = (
  description: string,
  fallbackSeed: string
): string => {
  const seed =
    fallbackSeed.replace(/\s+/g, ' ').trim() ||
    '귀엽고 따뜻한 캐릭터의 다양한 표정과 일상 반응을 담아 대화에서 자연스럽게 쓰기 좋은 이모티콘입니다.';
  let result = normalizeDescription(description || seed);

  while (result.length < 130) {
    result = normalizeDescription(`${result} ${seed}`);
    if (result.length >= 130 || result.length === 155) break;
  }

  return result;
};

export const normalizeTags = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const normalized = tag
      .replace(/^#+/, '')
      .replace(/\s+/g, '')
      .trim();

    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length === 15) break;
  }

  return result;
};

export const extractJsonObject = (text: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    }
  }

  throw new Error('JSON object response expected');
};
