'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Props {
  onConfirm: (dataUrl: string) => void;
  onClose: () => void;
  initialImage?: string | null;
}

export default function SketchCanvas({ onConfirm, onClose, initialImage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(6);
  const [brushColor, setBrushColor] = useState('#000000');
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);

  // 캔버스 초기화
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (initialImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveHistory();
      };
      img.src = initialImage;
    } else {
      saveHistory();
    }
  }, []);

  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(imageData);
    historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  }, []);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPos.current) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : brushColor;
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }, [isDrawing, brushColor, brushSize, tool]);

  const endDraw = useCallback(() => {
    if (isDrawing) { setIsDrawing(false); saveHistory(); }
    lastPos.current = null;
  }, [isDrawing, saveHistory]);

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
  };

  const handleLoadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
        saveHistory();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL('image/png'));
  };

  const colors = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

  return (
    <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">밑그림 그림판</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
          <div className="flex gap-1">
            <button onClick={() => setTool('pen')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>펜</button>
            <button onClick={() => setTool('eraser')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>지우개</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">굵기</span>
            <input type="range" min="1" max="30" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-20" />
            <span className="text-xs font-bold text-slate-700 w-4">{brushSize}</span>
          </div>
          <div className="flex gap-1">
            {colors.map(c => (
              <button key={c} onClick={() => { setBrushColor(c); setTool('pen'); }}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${brushColor === c && tool === 'pen' ? 'border-indigo-500 scale-110' : 'border-white'}`}
                style={{ backgroundColor: c, boxShadow: '0 0 0 1px #e2e8f0' }} />
            ))}
          </div>
          <div className="flex gap-1 ml-auto">
            <button onClick={handleUndo} className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs">↩ 취소</button>
            <button onClick={handleRedo} className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs">↪ 복원</button>
            <button onClick={handleClear} className="px-2 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-xs">지우기</button>
            <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs">이미지 불러오기</button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLoadImage} />
          </div>
        </div>

        {/* Canvas */}
        <div className="relative bg-slate-100 flex items-center justify-center p-2">
          <canvas
            ref={canvasRef}
            width={512}
            height={512}
            className="bg-white rounded-lg cursor-crosshair touch-none"
            style={{ maxWidth: '100%', maxHeight: '60vh' }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">취소</button>
          <button onClick={handleConfirm} className="px-6 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700">참조 이미지로 사용</button>
        </div>
      </div>
    </div>
  );
}
