import {
  OUTPUT_WIDTH,
  OUTPUT_HEIGHT,
  OGQ_MAIN_WIDTH,
  OGQ_MAIN_HEIGHT,
  OGQ_TAB_WIDTH,
  OGQ_TAB_HEIGHT,
} from '@/constants';

interface ProcessOptions {
  outputWidth?: number;
  outputHeight?: number;
  scaleRatio?: number;
  padding?: number;
  whiteThreshold?: number;
  softEdgeBand?: number;
}

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  hasContent: boolean;
}

interface ClippingOptions {
  margin?: number;
  alphaThreshold?: number;
  whiteThreshold?: number;
  softEdgeBand?: number;
}

interface CroppedSource {
  canvas: HTMLCanvasElement;
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });

const removeWhiteBackground = (
  data: Uint8ClampedArray,
  width: number,
  whiteThreshold: number,
  softEdgeBand: number
): { minX: number; minY: number; maxX: number; maxY: number; hasContent: boolean } => {
  const height = data.length / 4 / width;
  const softBandStart = whiteThreshold - softEdgeBand;
  const total = width * height;

  // BFS uses only the hard threshold so anti-aliased gradients don't bridge
  // into internal white areas (eyes, shirt, nails). A separate adjacency pass
  // then applies soft-edge alpha to border pixels that sit between background
  // and foreground, giving smooth edges without over-erasing.
  const isHardBg = (px: number) =>
    Math.min(data[px * 4], data[px * 4 + 1], data[px * 4 + 2]) >= whiteThreshold;

  // background: 0=foreground, 1=hard background, 2=soft edge
  const background = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0, tail = 0;

  const seed = (px: number) => {
    if (!background[px] && isHardBg(px)) {
      background[px] = 1;
      queue[tail++] = px;
    }
  };

  for (let x = 0; x < width; x++) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    seed(y * width);
    seed(y * width + width - 1);
  }

  while (head < tail) {
    const px = queue[head++];
    const x = px % width;
    const y = Math.floor(px / width);
    if (x > 0)          seed(px - 1);
    if (x < width - 1)  seed(px + 1);
    if (y > 0)          seed(px - width);
    if (y < height - 1) seed(px + width);
  }

  // Mark pixels adjacent to background whose brightness falls in the soft band
  if (softEdgeBand > 0) {
    for (let px = 0; px < total; px++) {
      if (background[px]) continue;
      const brightness = Math.min(data[px * 4], data[px * 4 + 1], data[px * 4 + 2]);
      if (brightness < softBandStart) continue;
      const x = px % width, y = Math.floor(px / width);
      if (
        (x > 0          && background[px - 1] === 1) ||
        (x < width - 1  && background[px + 1] === 1) ||
        (y > 0          && background[px - width] === 1) ||
        (y < height - 1 && background[px + width] === 1)
      ) {
        background[px] = 2;
      }
    }
  }

  let minX = width, minY = height, maxX = 0, maxY = 0;
  let hasContent = false;

  for (let px = 0; px < total; px++) {
    const idx = px * 4;
    if (background[px] === 1) {
      data[idx + 3] = 0;
    } else if (background[px] === 2) {
      const brightness = Math.min(data[idx], data[idx + 1], data[idx + 2]);
      const t = (brightness - softBandStart) / softEdgeBand;
      data[idx + 3] = Math.round(data[idx + 3] * (1 - t));
    }

    if (data[idx + 3] > 0) {
      const x = px % width;
      const y = Math.floor(px / width);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      hasContent = true;
    }
  }

  return { minX, minY, maxX, maxY, hasContent };
};

// Public alias for removeWhiteBackground — used by OutlinePackager and detectImageClipping.
// Uses the same strict 2-pass BFS so internal white areas (eyes, shirt, nails) are not erased.
export const removeEdgeConnectedBackground = (
  data: Uint8ClampedArray,
  width: number,
  whiteThreshold: number,
  softEdgeBand: number
): ContentBounds => {
  const bounds = removeWhiteBackground(data, width, whiteThreshold, softEdgeBand);
  return bounds;
};

export const detectEdgeClipping = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  margin = 2,
  alphaThreshold = 10
): boolean => {
  const safeMargin = Math.max(0, Math.floor(margin));
  for (let px = 0; px < width * height; px++) {
    if (data[px * 4 + 3] <= alphaThreshold) continue;
    const x = px % width;
    const y = Math.floor(px / width);
    if (x < safeMargin || y < safeMargin || x >= width - safeMargin || y >= height - safeMargin) {
      return true;
    }
  }
  return false;
};

export const detectImageClipping = async (
  base64Url: string,
  options: ClippingOptions = {}
): Promise<boolean> => {
  const { margin = 6, alphaThreshold = 10, whiteThreshold = 240, softEdgeBand = 12 } = options;
  const img = await loadImage(base64Url);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  removeEdgeConnectedBackground(imageData.data, img.width, whiteThreshold, softEdgeBand);
  return detectEdgeClipping(imageData.data, img.width, img.height, margin, alphaThreshold);
};

const cropContent = async (
  base64Url: string,
  whiteThreshold: number,
  softEdgeBand: number
): Promise<CroppedSource> => {
  const img = await loadImage(base64Url);
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    throw new Error('Could not get temp canvas context');
  }

  tempCtx.drawImage(img, 0, 0);

  const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
  const bounds = removeWhiteBackground(
    imageData.data,
    img.width,
    whiteThreshold,
    softEdgeBand
  );
  tempCtx.putImageData(imageData, 0, 0);

  let srcX = 0;
  let srcY = 0;
  let srcW = img.width;
  let srcH = img.height;

  if (bounds.hasContent) {
    srcX = bounds.minX;
    srcY = bounds.minY;
    srcW = bounds.maxX - bounds.minX + 1;
    srcH = bounds.maxY - bounds.minY + 1;

    const padding = 2;
    srcX = Math.max(0, srcX - padding);
    srcY = Math.max(0, srcY - padding);
    srcW = Math.min(img.width - srcX, srcW + padding * 2);
    srcH = Math.min(img.height - srcY, srcH + padding * 2);
  }

  return { canvas: tempCanvas, srcX, srcY, srcW, srcH };
};

const composeOnTransparent = (
  source: CroppedSource,
  outputWidth: number,
  outputHeight: number,
  scaleRatio: number,
  padding = 15
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, outputWidth, outputHeight);

  const availW = outputWidth - padding * 2;
  const availH = outputHeight - padding * 2;
  const scale = Math.min(availW / source.srcW, availH / source.srcH);

  const destW = source.srcW * scale;
  const destH = source.srcH * scale;
  const destX = padding + (availW - destW) / 2;
  const destY = padding + (availH - destH) / 2;

  ctx.drawImage(
    source.canvas,
    source.srcX,
    source.srcY,
    source.srcW,
    source.srcH,
    destX,
    destY,
    destW,
    destH
  );

  return canvas.toDataURL('image/png');
};

export const processImageForOutput = async (
  base64Url: string,
  options: ProcessOptions = {}
): Promise<string> => {
  const {
    outputWidth = OUTPUT_WIDTH,
    outputHeight = OUTPUT_HEIGHT,
    scaleRatio = 0.86,
    padding = 15,
    whiteThreshold = 240,
    softEdgeBand = 12,
  } = options;

  const cropped = await cropContent(base64Url, whiteThreshold, softEdgeBand);
  return composeOnTransparent(cropped, outputWidth, outputHeight, scaleRatio, padding);
};

export const buildOgqMainImage = (processedStickerDataUrl: string): Promise<string> =>
  processImageForOutput(processedStickerDataUrl, {
    outputWidth: OGQ_MAIN_WIDTH,
    outputHeight: OGQ_MAIN_HEIGHT,
    scaleRatio: 0.82,
    padding: 15,
    whiteThreshold: 250,
    softEdgeBand: 4,
  });

export const buildOgqTabImage = (processedStickerDataUrl: string): Promise<string> =>
  processImageForOutput(processedStickerDataUrl, {
    outputWidth: OGQ_TAB_WIDTH,
    outputHeight: OGQ_TAB_HEIGHT,
    scaleRatio: 0.86,
    padding: 6,
    whiteThreshold: 250,
    softEdgeBand: 4,
  });

export const flattenOnWhite = async (base64Url: string): Promise<string> => {
  const img = await loadImage(base64Url);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
};

export const removeSpecks = (
  data: Uint8ClampedArray,
  width: number,
  alphaThreshold = 10
): void => {
  const total = data.length / 4;
  const height = total / width;
  const visited = new Uint8Array(total);
  const components: number[][] = [];

  for (let px = 0; px < total; px++) {
    if (visited[px] || data[px * 4 + 3] <= alphaThreshold) {
      visited[px] = 1;
      continue;
    }
    // BFS to find connected component
    const component: number[] = [];
    const queue: number[] = [px];
    visited[px] = 1;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      component.push(cur);
      const x = cur % width;
      const y = Math.floor(cur / width);
      const neighbors = [
        x > 0 ? cur - 1 : -1,
        x < width - 1 ? cur + 1 : -1,
        y > 0 ? cur - width : -1,
        y < height - 1 ? cur + width : -1,
      ];
      for (const nb of neighbors) {
        if (nb >= 0 && !visited[nb] && data[nb * 4 + 3] > alphaThreshold) {
          visited[nb] = 1;
          queue.push(nb);
        }
      }
    }
    components.push(component);
  }

  if (components.length === 0) return;

  const maxSize = Math.max(...components.map((c) => c.length));
  const threshold = maxSize * 0.02;

  for (const component of components) {
    if (component.length < threshold) {
      for (const px of component) {
        data[px * 4 + 3] = 0;
      }
    }
  }
};

export const restoreEnclosedPixels = (
  data: Uint8ClampedArray,
  width: number
): void => {
  const total = data.length / 4;
  const height = total / width;
  // BFS flood fill from all border transparent pixels to find "outside" transparent pixels
  const outside = new Uint8Array(total);
  const queue: number[] = [];

  const enqueue = (px: number) => {
    if (!outside[px] && data[px * 4 + 3] === 0) {
      outside[px] = 1;
      queue.push(px);
    }
  };

  for (let x = 0; x < width; x++) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const x = cur % width;
    const y = Math.floor(cur / width);
    if (x > 0)          enqueue(cur - 1);
    if (x < width - 1)  enqueue(cur + 1);
    if (y > 0)          enqueue(cur - width);
    if (y < height - 1) enqueue(cur + width);
  }

  // Any transparent pixel NOT reachable from the border is enclosed — restore to white
  for (let px = 0; px < total; px++) {
    if (data[px * 4 + 3] === 0 && !outside[px]) {
      const idx = px * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }
};

export const dataUrlToBase64 = (dataUrl: string): string =>
  dataUrl.replace(/^data:image\/(png|jpe?g);base64,/, '');

export const downloadImage = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
