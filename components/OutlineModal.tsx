'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { addOutlineToPng, makeCheckerDataUrl, OutlineOptions } from '@/lib/outlineUtils';

interface Props {
  imageUrl: string;
  itemId: number;
  onClose: () => void;
  onSave: (newDataUrl: string, itemId: number) => void;
}

export default function OutlineModal({ imageUrl, itemId, onClose, onSave }: Props) {
  const [strokeWidth, setStrokeWidth] = useState(8);
  const [color, setColor] = useState('#ffffff');
  const [rounded, setRounded] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkerBg, setCheckerBg] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 체커보드 배경 초기화
  useEffect(() => {
    setCheckerBg(makeCheckerDataUrl(360, 360, 12));
  }, []);

  const runPreview = useCallback(async (opts: OutlineOptions) => {
    setIsProcessing(true);
    try {
      const result = await addOutlineToPng(imageUrl, opts);
      setPreview(result);
    } catch (e) {
      console.error('외곽선 미리보기 실패:', e);
    } finally {
      setIsProcessing(false);
    }
  }, [imageUrl]);

  // 옵션 변경 시 디바운스 미리보기
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runPreview({ width: strokeWidth, color, rounded });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [strokeWidth, color, rounded, runPreview]);

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      const result = await addOutlineToPng(imageUrl, { width: strokeWidth, color, rounded });
      onSave(result, itemId);
      onClose();
    } catch (e) {
      alert('외곽선 적용에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentPreview = preview || imageUrl;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M4 5a1 1 0 011-1h4a1 1 0 010 2H6.414l8 8H15a1 1 0 010 2h-4a1 1 0 01-.707-.293l-9-9A1 1 0 011 5zm14 0a1 1 0 00-1 1v4a1 1 0 001.293.707l9-9A1 1 0 0019 5h-1z" />
            </svg>
            <h3 className="text-lg font-bold text-slate-800">PNG 외곽선 추가 — #{itemId}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-0">
          {/* 미리보기 영역 */}
          <div className="relative flex-shrink-0 w-full md:w-56 h-56 overflow-hidden"
            style={{ background: `url(${checkerBg}) repeat` }}>
            {currentPreview && (
              <img
                src={currentPreview}
                alt="미리보기"
                className="w-full h-full object-contain p-3"
              />
            )}
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <div className="absolute bottom-2 left-2 text-[10px] text-slate-500 bg-white/80 px-1.5 py-0.5 rounded">
              미리보기
            </div>
          </div>

          {/* 컨트롤 패널 */}
          <div className="flex-1 p-5 space-y-5 border-t md:border-t-0 md:border-l border-slate-100">

            {/* 두께 슬라이더 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">테두리 두께</label>
                <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                  {strokeWidth}px
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>1px</span>
                <span>30px</span>
              </div>
            </div>

            {/* 색상 선택 */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">테두리 색상</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border-2 border-slate-200 cursor-pointer p-0.5"
                />
                <div className="flex gap-2 flex-wrap">
                  {['#ffffff', '#000000', '#ff4444', '#4444ff', '#ffdd00', '#44cc44'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                        color === c ? 'border-indigo-500 scale-110 shadow-md' : 'border-slate-300'
                      }`}
                      style={{ background: c }}
                      title={c}
                    />
                  ))}
                </div>
                <span className="text-sm font-mono text-slate-500 ml-1">{color}</span>
              </div>
            </div>

            {/* 둥근 외곽선 토글 */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rounded}
                    onChange={(e) => setRounded(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors ${rounded ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${rounded ? 'translate-x-5' : ''}`} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">부드러운(둥근) 외곽선</div>
                  <div className="text-xs text-slate-400">가우시안 블러로 가장자리를 부드럽게 처리</div>
                </div>
              </label>
            </div>

            {/* 팁 */}
            <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700 flex gap-2">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>OGQ 심사 기준: 흰색 외곽선(8~12px)이 배경과의 경계를 명확히 하여 통과율을 높입니다.</span>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-slate-500 hover:bg-slate-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isProcessing}
            className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                외곽선 적용
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
