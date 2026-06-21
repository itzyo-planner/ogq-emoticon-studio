// One-shot real generation test: hits /api/generate on the local dev server
// with provider=codex four times, each time injecting a different composition
// drawn from lib/composition.ts. Saves each PNG into ./screenshots/real/.
// Logs the prompt that was actually sent so we can verify the framing differs.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { COMPOSITIONS, distributeCompositions } from '../lib/composition.ts';

const BASE_URL = process.env.STUDIO_URL ?? 'http://127.0.0.1:3004';

const CHARACTER = '빨간 나비넥타이를 한 통통한 노란 오리, 귀여운 스타일, 생동감 있는 색상';
const STYLE = 'Sticker, Flat Vector, 2D, bold outlines, cel shading';

const SCENARIO_PROMPTS = [
  'Waving hello cheerfully',
  'Crying tears, single sparkling teardrop on cheek',
  'Running late, papers flying behind',
  'Heart eyes confession, blushing cheeks',
];

const compositions = distributeCompositions(SCENARIO_PROMPTS, {
  theme: CHARACTER,
});

const OUT_DIR = 'screenshots/real';
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const generate = async (slot, scenarioPrompt, composition) => {
  const started = Date.now();
  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'codex',
      model: 'codex-image-1',
      apiKey: '',
      characterDesc: CHARACTER,
      scenarioPrompt,
      style: STYLE,
      referenceImageBase64: null,
      composition: composition.prompt,
    }),
  });

  const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

  if (!res.ok) {
    const body = await res.text();
    console.error(`[slot ${slot}] FAILED (${res.status}, ${elapsedSec}s): ${body.slice(0, 240)}`);
    return { ok: false, slot };
  }

  const data = await res.json();
  if (!data.success || !data.imageData) {
    console.error(`[slot ${slot}] FAILED: ${JSON.stringify(data).slice(0, 240)}`);
    return { ok: false, slot };
  }

  const base64 = data.imageData.replace(/^data:image\/png;base64,/, '');
  const path = `${OUT_DIR}/slot-${slot}-${composition.id}.png`;
  writeFileSync(path, Buffer.from(base64, 'base64'));
  console.log(`[slot ${slot}] OK in ${elapsedSec}s → ${path}  (${composition.label})`);
  return { ok: true, slot, path, composition: composition.label };
};

(async () => {
  console.log(`Composition plan for ${SCENARIO_PROMPTS.length} slots:`);
  SCENARIO_PROMPTS.forEach((p, i) => {
    console.log(`  #${i + 1} "${p}"  →  ${compositions[i].label}`);
  });
  console.log('');

  // Run sequentially so the Codex proxy doesn't get hammered.
  const results = [];
  for (let i = 0; i < SCENARIO_PROMPTS.length; i++) {
    const r = await generate(i + 1, SCENARIO_PROMPTS[i], compositions[i]);
    results.push(r);
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n${ok}/${results.length} generations succeeded.`);
  process.exit(ok === results.length ? 0 : 1);
})();
