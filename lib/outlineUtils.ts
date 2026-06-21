/**
 * PNG 외곽선(테두리) 생성 유틸리티
 * outline_app.py (PyInstaller EXE)의 기능을 웹 Canvas API로 재구현
 *
 * 원본 알고리즘:
 *  1. make_stroke_mask: 알파채널 기반 마스크 팽창(MaxFilter) → 가우시안 블러 → 외곽선 마스크 생성
 *  2. add_outline: 외곽선 레이어를 원본 위에 합성
 *  3. rounded 옵션: 블러 반경을 크게 잡아 부드러운 테두리 효과
 */

export interface OutlineOptions {
  /** 외곽선 두께 (px, 1-30) */
  width: number;
  /** 외곽선 색상 (hex: '#ffffff') */
  color: string;
  /** 부드러운(둥근) 외곽선 여부 */
  rounded: boolean;
  /** 알파 임계값 (0-255, 이 값 이상의 픽셀을 불투명으로 처리) */
  alphaThreshold?: number;
}

/** hex 색상 → { r, g, b } */
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
};

/**
 * 알파채널 팽창 (MaxFilter 근사)
 * 각 픽셀 주변 radius 범위 내 최대 알파값을 적용
 */
const dilateAlpha = (
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray => {
  const dst = new Uint8ClampedArray(src.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxA = 0;
      const yStart = Math.max(0, y - radius);
      const yEnd = Math.min(height - 1, y + radius);
      const xStart = Math.max(0, x - radius);
      const xEnd = Math.min(width - 1, x + radius);

      for (let ny = yStart; ny <= yEnd; ny++) {
        for (let nx = xStart; nx <= xEnd; nx++) {
          const a = src[(ny * width + nx) * 4 + 3];
          if (a > maxA) maxA = a;
        }
      }
      const i = (y * width + x) * 4;
      dst[i] = dst[i + 1] = dst[i + 2] = 0;
      dst[i + 3] = maxA;
    }
  }
  return dst;
};

/**
 * 가우시안 블러 (1D 분리 근사, 빠른 박스 블러 사용)
 */
const boxBlurAlpha = (
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray => {
  if (radius < 1) return src;
  const dst = new Uint8ClampedArray(src.length);
  const r = Math.round(radius);

  // 수평 패스
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -r; k <= r; k++) {
        const nx = x + k;
        if (nx >= 0 && nx < width) {
          sum += src[(y * width + nx) * 4 + 3];
          count++;
        }
      }
      const i = (y * width + x) * 4;
      dst[i + 3] = sum / count;
    }
  }

  // 수직 패스
  const dst2 = new Uint8ClampedArray(dst.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -r; k <= r; k++) {
        const ny = y + k;
        if (ny >= 0 && ny < height) {
          sum += dst[(ny * width + x) * 4 + 3];
          count++;
        }
      }
      const i = (y * width + x) * 4;
      dst2[i + 3] = sum / count;
    }
  }
  return dst2;
};

/**
 * 외곽선 마스크 생성
 * 원본 알파가 임계값 미만인 픽셀 중, 팽창된 마스크에서 알파가 있는 픽셀 = 외곽선 영역
 */
const makeStrokeMask = (
  originalAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  strokeWidth: number,
  rounded: boolean,
  alphaThreshold: number
): Uint8ClampedArray => {
  // 1) 원본 알파 채널 추출
  const alphaSrc = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const a = originalAlpha[i * 4 + 3];
    alphaSrc[i * 4 + 3] = a >= alphaThreshold ? 255 : 0;
  }

  // 2) 팽창
  const grown = dilateAlpha(alphaSrc, width, height, strokeWidth);

  // 3) rounded 시 블러 추가
  const radius = rounded ? Math.max(1, strokeWidth * 0.5) : 0;
  const blurred = radius > 0 ? boxBlurAlpha(grown, width, height, radius) : grown;

  // 4) 원본 알파가 있는 영역 제거 → 순수 외곽선만 남김
  const mask = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const origA = originalAlpha[i * 4 + 3];
    if (origA < alphaThreshold) {
      mask[i * 4 + 3] = blurred[i * 4 + 3];
    }
  }
  return mask;
};

/**
 * PNG dataURL에 외곽선을 추가하고 새 dataURL을 반환
 */
export const addOutlineToPng = (
  dataUrl: string,
  options: OutlineOptions
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      const { color, width: strokeWidth, rounded, alphaThreshold = 10 } = options;
      const { r, g, b } = hexToRgb(color);

      // 원본 이미지를 캔버스에 그리기
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = width;
      srcCanvas.height = height;
      const srcCtx = srcCanvas.getContext('2d');
      if (!srcCtx) return reject(new Error('canvas context 실패'));
      srcCtx.drawImage(img, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, width, height);

      // 외곽선 마스크 생성
      const strokeMask = makeStrokeMask(
        srcData.data,
        width,
        height,
        strokeWidth,
        rounded,
        alphaThreshold
      );

      // 결과 캔버스: 외곽선 레이어 → 원본 합성
      const outCanvas = document.createElement('canvas');
      outCanvas.width = width;
      outCanvas.height = height;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) return reject(new Error('canvas context 실패'));

      // 외곽선 픽셀 채우기
      const outData = outCtx.createImageData(width, height);
      for (let i = 0; i < width * height; i++) {
        const maskA = strokeMask[i * 4 + 3];
        outData.data[i * 4] = r;
        outData.data[i * 4 + 1] = g;
        outData.data[i * 4 + 2] = b;
        outData.data[i * 4 + 3] = maskA;
      }
      outCtx.putImageData(outData, 0, 0);

      // 원본 이미지를 위에 합성
      outCtx.drawImage(srcCanvas, 0, 0);

      resolve(outCanvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = dataUrl;
  });
};

/**
 * 미리보기용 체커보드 배경 생성
 */
export const makeCheckerDataUrl = (width: number, height: number, size = 10): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? '#cccccc' : '#ffffff';
      ctx.fillRect(x, y, size, size);
    }
  }
  return canvas.toDataURL();
};
