#!/usr/bin/env python3
"""
배치보정.py - 이모티콘 이미지 배치 후처리 CLI
사용법: python 배치보정.py <입력폴더> <출력폴더> [옵션]

옵션:
  --nukki           누끼 처리 (flood fill)
  --grabcut         GrabCut 누끼 (더 정밀)
  --border-width N  외곽선 두께 (기본 3)
  --border-color C  외곽선 색상 hex (기본 #ffffff)
  --padding N       캔버스 여백 픽셀 (기본 15)
  --size WxH        출력 크기 (기본 740x640)
  --remove-specks   작은 잡음 점 제거
"""
import sys
import os
import argparse
import base64
import json
from pathlib import Path
import numpy as np

def process_image(img, args, cv2):
    h, w = img.shape[:2]
    if img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    # 누끼 처리
    if args.nukki or args.grabcut:
        if args.grabcut:
            margin = max(5, min(w, h) // 20)
            rect = (margin, margin, w - 2*margin, h - 2*margin)
            mask = np.zeros((h, w), dtype=np.uint8)
            bgd = np.zeros((1,65), np.float64); fgd = np.zeros((1,65), np.float64)
            cv2.grabCut(img[:,:,:3], mask, rect, bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
            fg = np.where((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
            img[:,:,3] = fg
        else:
            gray = cv2.cvtColor(img[:,:,:3], cv2.COLOR_BGR2GRAY)
            flood_mask = np.zeros((h+2, w+2), dtype=np.uint8)
            for x in range(0, w, 8):
                cv2.floodFill(gray.copy(), flood_mask, (x,0), 0, loDiff=15, upDiff=15, flags=4|cv2.FLOODFILL_MASK_ONLY)
                cv2.floodFill(gray.copy(), flood_mask, (x,h-1), 0, loDiff=15, upDiff=15, flags=4|cv2.FLOODFILL_MASK_ONLY)
            for y in range(0, h, 8):
                cv2.floodFill(gray.copy(), flood_mask, (0,y), 0, loDiff=15, upDiff=15, flags=4|cv2.FLOODFILL_MASK_ONLY)
                cv2.floodFill(gray.copy(), flood_mask, (w-1,y), 0, loDiff=15, upDiff=15, flags=4|cv2.FLOODFILL_MASK_ONLY)
            img[:,:,3] = np.where(flood_mask[1:-1,1:-1]>0, 0, 255).astype(np.uint8)

    # 잔여 점 제거
    if args.remove_specks:
        alpha = img[:,:,3]
        ret, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 10).astype(np.uint8), connectivity=8)
        if ret > 1:
            sizes = stats[1:, cv2.CC_STAT_AREA]
            max_size = sizes.max()
            for i, size in enumerate(sizes, 1):
                if size < max_size * 0.02:
                    img[:,:,3][labels == i] = 0

    # 외곽선 추가
    if args.border_width > 0:
        alpha = img[:,:,3]
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (args.border_width*2+1, args.border_width*2+1))
        dilated = cv2.dilate(alpha, kernel)
        border_mask = cv2.bitwise_and(dilated, cv2.bitwise_not(alpha))
        color_hex = args.border_color.lstrip('#')
        r, g, b = tuple(int(color_hex[i:i+2], 16) for i in (0, 2, 4))
        border_layer = np.zeros_like(img)
        border_layer[:,:,0] = b; border_layer[:,:,1] = g; border_layer[:,:,2] = r
        border_layer[:,:,3] = border_mask
        # 원본 위에 합성
        alpha_src = img[:,:,3:4] / 255.0
        alpha_brd = border_layer[:,:,3:4] / 255.0
        out_alpha = alpha_src + alpha_brd * (1 - alpha_src)
        out_rgb = (img[:,:,:3] * alpha_src + border_layer[:,:,:3] * alpha_brd * (1 - alpha_src)) / np.maximum(out_alpha, 1e-6)
        result = np.zeros_like(img)
        result[:,:,:3] = out_rgb.clip(0, 255).astype(np.uint8)
        result[:,:,3] = (out_alpha[:,:,0] * 255).clip(0, 255).astype(np.uint8)
        img = result

    # 캔버스 맞춤 (패딩 + 크기 조정)
    size_parts = args.size.split('x')
    out_w, out_h = int(size_parts[0]), int(size_parts[1])
    pad = args.padding
    avail_w = out_w - pad * 2
    avail_h = out_h - pad * 2

    # 콘텐츠 영역 크롭
    alpha = img[:,:,3]
    ys, xs = np.where(alpha > 10)
    if len(xs) > 0:
        x1, y1, x2, y2 = xs.min(), ys.min(), xs.max(), ys.max()
        img = img[y1:y2+1, x1:x2+1]

    ih, iw = img.shape[:2]
    scale = min(avail_w / iw, avail_h / ih)
    new_w, new_h = int(iw * scale), int(ih * scale)
    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

    canvas = np.zeros((out_h, out_w, 4), dtype=np.uint8)
    x_off = pad + (avail_w - new_w) // 2
    y_off = pad + (avail_h - new_h) // 2
    canvas[y_off:y_off+new_h, x_off:x_off+new_w] = resized

    return canvas

def main():
    parser = argparse.ArgumentParser(description='이모티콘 배치 후처리')
    parser.add_argument('input', help='입력 폴더')
    parser.add_argument('output', help='출력 폴더')
    parser.add_argument('--nukki', action='store_true')
    parser.add_argument('--grabcut', action='store_true')
    parser.add_argument('--border-width', type=int, default=3)
    parser.add_argument('--border-color', default='#ffffff')
    parser.add_argument('--padding', type=int, default=15)
    parser.add_argument('--size', default='740x640')
    parser.add_argument('--remove-specks', action='store_true')
    args = parser.parse_args()

    try:
        import cv2
    except ImportError:
        print('오류: pip install opencv-python 필요')
        sys.exit(1)

    in_dir = Path(args.input)
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    png_files = list(in_dir.glob('*.png')) + list(in_dir.glob('*.jpg'))
    if not png_files:
        print(f'입력 폴더에 이미지 없음: {in_dir}')
        sys.exit(1)

    print(f'{len(png_files)}개 이미지 처리 중...')
    for i, fpath in enumerate(sorted(png_files), 1):
        img = cv2.imread(str(fpath), cv2.IMREAD_UNCHANGED)
        if img is None:
            print(f'  [{i}] 건너뜀 (읽기 실패): {fpath.name}')
            continue
        try:
            result = process_image(img, args, cv2)
            out_path = out_dir / fpath.name
            cv2.imwrite(str(out_path), result)
            print(f'  [{i}/{len(png_files)}] 완료: {fpath.name}')
        except Exception as e:
            print(f'  [{i}] 오류 ({fpath.name}): {e}')

    print(f'\n완료! 출력: {out_dir}')

if __name__ == '__main__':
    main()
