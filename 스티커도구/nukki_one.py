#!/usr/bin/env python3
"""
nukki_one.py - 단일 이미지 누끼 처리 (stdin base64 → stdout base64)
사용법: echo "<base64>" | python nukki_one.py [--grabcut]

의존: opencv-python, numpy
"""
import sys
import base64
import io
import argparse
import numpy as np

def flood_fill_nukki(img_bgra):
    """가장자리 연결 흰색 배경 제거 (연결성 플러드 필)"""
    h, w = img_bgra.shape[:2]
    gray = cv2.cvtColor(img_bgra[:,:,:3], cv2.COLOR_BGR2GRAY)
    mask = np.zeros((h + 2, w + 2), dtype=np.uint8)

    # 모든 모서리에서 플러드 필
    for x in range(0, w, 10):
        cv2.floodFill(gray.copy(), mask, (x, 0), 0, loDiff=15, upDiff=15, flags=4 | cv2.FLOODFILL_MASK_ONLY)
        cv2.floodFill(gray.copy(), mask, (x, h-1), 0, loDiff=15, upDiff=15, flags=4 | cv2.FLOODFILL_MASK_ONLY)
    for y in range(0, h, 10):
        cv2.floodFill(gray.copy(), mask, (0, y), 0, loDiff=15, upDiff=15, flags=4 | cv2.FLOODFILL_MASK_ONLY)
        cv2.floodFill(gray.copy(), mask, (w-1, y), 0, loDiff=15, upDiff=15, flags=4 | cv2.FLOODFILL_MASK_ONLY)

    bg_mask = mask[1:-1, 1:-1]
    result = img_bgra.copy()
    result[:,:,3] = np.where(bg_mask > 0, 0, 255).astype(np.uint8)
    return result

def grabcut_nukki(img_bgra):
    """GrabCut 기반 누끼 처리"""
    h, w = img_bgra.shape[:2]
    img_bgr = img_bgra[:,:,:3]

    margin = max(5, min(w, h) // 20)
    rect = (margin, margin, w - 2*margin, h - 2*margin)

    mask = np.zeros((h, w), dtype=np.uint8)
    bgd_model = np.zeros((1, 65), dtype=np.float64)
    fgd_model = np.zeros((1, 65), dtype=np.float64)

    cv2.grabCut(img_bgr, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
    fg_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    result = img_bgra.copy()
    result[:,:,3] = fg_mask
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--grabcut', action='store_true')
    args = parser.parse_args()

    try:
        import cv2
    except ImportError:
        print('{"error": "opencv-python not installed. Run: pip install opencv-python"}', file=sys.stderr)
        sys.exit(1)

    raw = sys.stdin.buffer.read()
    # base64 디코딩 (헤더 제거)
    b64 = raw.decode('utf-8', errors='ignore').strip()
    if ',' in b64:
        b64 = b64.split(',', 1)[1]

    img_bytes = base64.b64decode(b64)
    nparr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)

    if img is None:
        print('{"error": "이미지 디코딩 실패"}', file=sys.stderr)
        sys.exit(1)

    # BGRA 변환
    if img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    if args.grabcut:
        result = grabcut_nukki(img)
    else:
        result = flood_fill_nukki(img)

    # PNG 인코딩 후 base64 출력
    _, buf = cv2.imencode('.png', result)
    out_b64 = base64.b64encode(buf.tobytes()).decode('utf-8')
    sys.stdout.write('data:image/png;base64,' + out_b64)

if __name__ == '__main__':
    main()
