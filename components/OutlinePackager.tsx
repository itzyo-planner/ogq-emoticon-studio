'use client';

/**
 * OutlinePackager — 드롭인(추가만 하면 되는) 외곽선 패키지 컴포넌트.
 *
 * 이 파일 1개를 components/ 에 넣고, 완성된 스티커 목록을 props 로 넘기면
 * "외곽선 설정 패널 + OGQ 패키지(외곽선 적용) 다운로드 버튼" 이 통째로 붙는다.
 * 외곽선 알고리즘이 파일 안에 인라인되어 있어 다른 의존 파일이 필요 없다.
 * (lib/imageUtils, jszip 은 기본 대시보드에 이미 포함되어 있는 것만 사용)
 *
 * 외곽선 알고리즘은 PNG외곽선메이커.exe(Pillow MaxFilter/GaussianBlur)를 그대로
 * 포팅한 것. 기본값: 두께 8px(0~60), 흰색(#ffffff), 둥근 모서리 ON, 알파 임계값 16.
 *
 * 사용 예 (StepGenerate.tsx 등에서):
 *   import OutlinePackager from './OutlinePackager';
 *   ...
 *   <OutlinePackager
 *     stickers={emoticons
 *       .filter((e) => e.status === 'completed' && e.imageUrl)
 *       .map((e) => e.imageUrl as string)}
 *   />
 */

import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import {
  buildOgqMainImage,
  buildOgqTabImage,
  dataUrlToBase64,
} from '@/lib/imageUtils';

// 투명 영역과 흰 외곽선을 동시에 확인하기 위한 체커보드 배경
const CHECKER_STYLE: React.CSSProperties = {
  backgroundColor: '#e5e7eb',
  backgroundImage:
    'linear-gradient(45deg,#cbd5e1 25%,transparent 25%),linear-gradient(-45deg,#cbd5e1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#cbd5e1 75%),linear-gradient(-45deg,transparent 75%,#cbd5e1 75%)',
  backgroundSize: '14px 14px',
  backgroundPosition: '0 0,0 7px,7px -7px,-7px 0',
};

/* ========================================================================
   외곽선 알고리즘 (self-contained)
   ======================================================================== */

type Buf = Float32Array<ArrayBufferLike>;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });

const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.replace('#', '');
  const full =
    m.length === 3 ? m.split('').map((c) => c + c).join('') : m.padEnd(6, '0').slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

// 정사각 최대값 필터 = PIL MaxFilter. separable(수평 max → 수직 max).
const maxFilterSquare = (src: Buf, W: number, H: number, size: number): Buf => {
  const r = (size - 1) >> 1;
  const tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let m = 0;
      const lo = Math.max(0, x - r);
      const hi = Math.min(W - 1, x + r);
      for (let xx = lo; xx <= hi; xx++) {
        const v = src[row + xx];
        if (v > m) m = v;
      }
      tmp[row + x] = m;
    }
  }
  const out = new Float32Array(W * H);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      let m = 0;
      const lo = Math.max(0, y - r);
      const hi = Math.min(H - 1, y + r);
      for (let yy = lo; yy <= hi; yy++) {
        const v = tmp[yy * W + x];
        if (v > m) m = v;
      }
      out[y * W + x] = m;
    }
  }
  return out;
};

// Separable 가우시안 블러. sigma = 표준편차(PIL GaussianBlur 규약). 경계는 클램프.
const gaussianBlur = (src: Buf, W: number, H: number, sigma: number): Buf => {
  if (sigma <= 0) return src.slice();
  const r = Math.max(1, Math.ceil(sigma * 3));
  const kernel = new Float32Array(2 * r + 1);
  let sum = 0;
  const inv = 1 / (2 * sigma * sigma);
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) * inv);
    kernel[i + r] = v;
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        let xx = x + k;
        if (xx < 0) xx = 0;
        else if (xx >= W) xx = W - 1;
        acc += src[row + xx] * kernel[k + r];
      }
      tmp[row + x] = acc;
    }
  }
  const out = new Float32Array(W * H);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      let acc = 0;
      for (let k = -r; k <= r; k++) {
        let yy = y + k;
        if (yy < 0) yy = 0;
        else if (yy >= H) yy = H - 1;
        acc += tmp[yy * W + x] * kernel[k + r];
      }
      out[y * W + x] = acc;
    }
  }
  return out;
};

const makeStrokeMask = (
  alpha: Buf,
  W: number,
  H: number,
  width: number,
  rounded: boolean,
  alphaThreshold: number
): Buf => {
  const n = W * H;
  const binary: Buf = new Float32Array(n);
  for (let i = 0; i < n; i++) binary[i] = alpha[i] > alphaThreshold ? 255 : 0;
  if (width <= 0) return binary;

  let grown: Buf = binary;
  let remaining = width;
  while (remaining > 0) {
    const step = Math.min(remaining, 5);
    grown = maxFilterSquare(grown, W, H, step * 2 + 1);
    remaining -= step;
  }

  if (rounded && width >= 2) {
    const radius = Math.max(1.0, width * 0.5);
    grown = gaussianBlur(grown, W, H, radius);
    for (let i = 0; i < n; i++) grown[i] = grown[i] >= 128 ? 255 : 0;
  }

  grown = gaussianBlur(grown, W, H, 1.5);
  const lo = 88;
  const hi = 168;
  const span = hi - lo;
  for (let i = 0; i < n; i++) {
    const p = grown[i];
    grown[i] = p <= lo ? 0 : p >= hi ? 255 : Math.trunc(((p - lo) * 255) / span);
  }
  return grown;
};

interface OutlineOptions {
  width: number;
  color: string;
  rounded: boolean;
  alphaThreshold: number;
}

const addOutline = async (
  dataUrl: string,
  { width, color, rounded, alphaThreshold }: OutlineOptions
): Promise<string> => {
  if (width <= 0) return dataUrl;

  const img = await loadImage(dataUrl);
  const W = img.width;
  const H = img.height;

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = W;
  srcCanvas.height = H;
  const sctx = srcCanvas.getContext('2d');
  if (!sctx) throw new Error('Could not get canvas context');
  sctx.drawImage(img, 0, 0);

  const srcImage = sctx.getImageData(0, 0, W, H);
  const n = W * H;
  const alpha: Buf = new Float32Array(n);
  for (let i = 0, p = 3; i < n; i++, p += 4) alpha[i] = srcImage.data[p];

  const mask = makeStrokeMask(alpha, W, H, width, rounded, alphaThreshold);

  const [cr, cg, cb] = hexToRgb(color);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Could not get canvas context');

  const strokeImage = octx.createImageData(W, H);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    strokeImage.data[p] = cr;
    strokeImage.data[p + 1] = cg;
    strokeImage.data[p + 2] = cb;
    strokeImage.data[p + 3] = Math.round(mask[i]);
  }
  octx.putImageData(strokeImage, 0, 0);
  octx.drawImage(srcCanvas, 0, 0); // 원본을 외곽선 레이어 위에 합성

  return out.toDataURL('image/png');
};

/* ========================================================================
   컴포넌트
   ======================================================================== */

interface Props {
  /** 완성된 스티커 dataURL 목록 (740x640 투명 PNG 권장). */
  stickers: string[];
  /** 대표(메인/탭) 스티커 인덱스. 기본 0. */
  mainIndex?: number;
  /** OGQ 필수 장수. 기본 24. */
  requiredCount?: number;
}

export default function OutlinePackager({
  stickers,
  mainIndex = 0,
  requiredCount = 24,
}: Props) {
  const [enabled, setEnabled] = useState(true);
  const [width, setWidth] = useState(8);
  const [color, setColor] = useState('#ffffff');
  const [rounded, setRounded] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const previewSource =
    stickers[previewIndex] ?? stickers[0] ?? null;

  // 선택한 스티커에 현재 설정을 적용해 실시간 미리보기(디바운스)
  useEffect(() => {
    if (!enabled || !previewSource) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const result = await addOutline(previewSource, {
          width,
          color,
          rounded,
          alphaThreshold: 16,
        });
        if (!cancelled) setPreviewUrl(result);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, width, color, rounded, previewSource]);

  if (!stickers.length) return null;

  const applyOutline = (dataUrl: string): Promise<string> =>
    enabled
      ? addOutline(dataUrl, { width, color, rounded, alphaThreshold: 16 })
      : Promise.resolve(dataUrl);

  const handleDownload = async () => {
    if (stickers.length < requiredCount) {
      const proceed = window.confirm(
        `OGQ 제출에는 ${requiredCount}장이 필요합니다. 현재 ${stickers.length}장만 완성되어 있습니다. 그래도 패키지를 만들까요?`
      );
      if (!proceed) return;
    }

    const main = stickers[mainIndex] ?? stickers[0];
    if (!main) {
      alert('패키지를 만들 완성된 이미지가 없습니다.');
      return;
    }

    setBusy(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('stickers');
      if (!folder) throw new Error('Failed to create stickers folder');

      const targets = stickers.slice(0, requiredCount);
      const outlined = await Promise.all(targets.map(applyOutline));
      outlined.forEach((dataUrl, idx) => {
        folder.file(`${idx + 1}.png`, dataUrlToBase64(dataUrl), { base64: true });
      });

      const mainOutlined = await applyOutline(main);
      const [mainImage, tabImage] = await Promise.all([
        buildOgqMainImage(mainOutlined),
        buildOgqTabImage(mainOutlined),
      ]);
      zip.file('main.png', dataUrlToBase64(mainImage), { base64: true });
      zip.file('tab.png', dataUrlToBase64(tabImage), { base64: true });

      const outlineLine = enabled
        ? `외곽선: ${color} / 두께 ${width}px / 둥근모서리 ${rounded ? 'ON' : 'OFF'}`
        : '외곽선: 미적용';
      zip.file(
        'README.txt',
        [
          'OGQ Creators Studio 제출 패키지',
          '',
          `스티커: stickers/1.png ~ ${requiredCount}.png (740x640)`,
          '메인 이미지: main.png (240x240)',
          '탭 이미지: tab.png (96x74)',
          outlineLine,
        ].join('\n')
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ogq-submission.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('OutlinePackager error:', e);
      alert('패키지 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-700">외곽선 (스트로크)</span>
          <span className="text-xs text-slate-400">
            OGQ 패키지에 자동 적용 · PNG외곽선메이커 설정
          </span>
        </div>
        <label className="inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 bg-slate-300 peer-checked:bg-purple-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
        </label>
      </div>

      {enabled && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 w-10">두께</span>
            <input
              type="range"
              min={0}
              max={60}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-40 accent-purple-600"
            />
            <span className="text-sm font-mono text-slate-700 w-12">{width}px</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">색상</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-9 h-9 rounded border border-slate-300 cursor-pointer p-0.5"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rounded}
              onChange={(e) => setRounded(e.target.checked)}
              className="accent-purple-600 w-4 h-4"
            />
            <span className="text-sm text-slate-600">둥근 모서리</span>
          </label>
        </div>
      )}

      {/* 미리보기: 스티커를 선택해 외곽선 적용 결과를 즉시 확인 */}
      {enabled && stickers.length > 0 && (
        <div className="mt-4 mb-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-slate-600">미리보기</span>
            {previewLoading && (
              <span className="text-xs text-purple-500">적용 중…</span>
            )}
            <span className="text-xs text-slate-400">
              썸네일을 눌러 다른 스티커로 확인
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {stickers.map((src, i) => (
              <button
                key={i}
                onClick={() => setPreviewIndex(i)}
                style={CHECKER_STYLE}
                className={`shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-colors ${
                  i === previewIndex
                    ? 'border-purple-600'
                    : 'border-transparent hover:border-slate-300'
                }`}
                title={`스티커 ${i + 1}`}
              >
                <img src={src} alt="" className="w-full h-full object-contain" />
              </button>
            ))}
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">원본</div>
              <div
                style={CHECKER_STYLE}
                className="w-40 h-40 rounded-lg overflow-hidden flex items-center justify-center p-2"
              >
                {previewSource && (
                  <img
                    src={previewSource}
                    alt="원본"
                    className="max-w-full max-h-full object-contain"
                  />
                )}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-slate-400 mb-1">
                외곽선 적용 ({color} · {width}px)
              </div>
              <div
                style={CHECKER_STYLE}
                className="w-40 h-40 rounded-lg overflow-hidden flex items-center justify-center p-2"
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="외곽선 적용"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">
                    {previewLoading ? '적용 중…' : '—'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={busy}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 shadow-md flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <svg
          className={`w-5 h-5 ${busy ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {busy ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          )}
        </svg>
        {busy ? '패키지 생성 중...' : 'OGQ 패키지 (외곽선)'}
      </button>
    </div>
  );
}
