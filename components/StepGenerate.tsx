'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Emoticon, GenerationConfig, ApiConfig } from '@/types';
import { generateEmoticonImage } from '@/lib/api';
import {
  processImageForOutput,
  downloadImage,
  buildOgqMainImage,
  buildOgqTabImage,
  dataUrlToBase64,
  detectImageClipping,
} from '@/lib/imageUtils';
import { findDuplicatePrompts } from '@/lib/promptUtils';
import {
  distributeCompositions,
  summarizeDistribution,
  Composition,
} from '@/lib/composition';
import { AI_MODELS, OGQ_REQUIRED_STICKERS } from '@/constants';
import JSZip from 'jszip';
import OutlineModal from '@/components/OutlineModal';
import OutlinePackager from '@/components/OutlinePackager';
import RecommendationCards from '@/components/RecommendationCards';

interface Props {
  apiConfig: ApiConfig;
  config: GenerationConfig;
  prompts: string[];
  onConfigUpdate: (config: GenerationConfig) => void;
  onPromptsUpdate: (prompts: string[]) => void;
}

interface EmoticonWithCost extends Emoticon {
  cost?: number;
}


export default function StepGenerate({ apiConfig, config, prompts, onConfigUpdate, onPromptsUpdate }: Props) {
  const [emoticons, setEmoticons] = useState<EmoticonWithCost[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingItem, setEditingItem] = useState<EmoticonWithCost | null>(null);
  const [outlineItem, setOutlineItem] = useState<EmoticonWithCost | null>(null);
  const [parallelCount, setParallelCount] = useState(1);
  const [hasStarted, setHasStarted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [useDarkPreview, setUseDarkPreview] = useState(false);
  const initialized = useRef(false);
  const abortRef = useRef(false);

  const currentModel = AI_MODELS.find((m) => m.id === apiConfig.model);
  const costPerImage = currentModel?.costPerImage || 0;

  const totalCount = emoticons.length;

  const compositionPlan = useMemo<Composition[]>(
    () =>
      distributeCompositions(prompts, {
        theme: config.characterDescription,
      }),
    [prompts, config.characterDescription]
  );

  const compositionSummary = useMemo(
    () => summarizeDistribution(compositionPlan),
    [compositionPlan]
  );
  const completedCount = emoticons.filter((e) => e.status === 'completed').length;
  const failedCount = emoticons.filter((e) => e.status === 'failed').length;
  const generatingCount = emoticons.filter((e) => e.status === 'generating').length;
  const isComplete = totalCount > 0 && completedCount + failedCount === totalCount;

  // Calculate costs
  const totalCost = emoticons.reduce((sum, e) => sum + (e.cost || 0), 0);
  const estimatedTotalCost = totalCount * costPerImage;
  const previewCardClass = useDarkPreview ? 'bg-slate-950' : 'bg-white';
  const placeholderClass = useDarkPreview
    ? 'bg-slate-900 text-slate-300'
    : 'bg-slate-50 text-slate-400';
  const generatingSurfaceClass = useDarkPreview
    ? 'bg-slate-900/80 text-indigo-200'
    : 'bg-slate-50/80 text-indigo-600';

  const updateStatus = useCallback((
    id: number,
    status: Emoticon['status'],
    imageUrl?: string,
    error?: string,
    newPrompt?: string,
    cost?: number
  ) => {
    setEmoticons((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            status,
            imageUrl: imageUrl !== undefined ? imageUrl : item.imageUrl,
            error,
            prompt: newPrompt !== undefined ? newPrompt : item.prompt,
            cost: cost !== undefined ? cost : item.cost,
          };
        }
        return item;
      })
    );
  }, []);

  const processItem = useCallback(async (item: EmoticonWithCost, customPrompt?: string): Promise<void> => {
    if (abortRef.current) return;

    const promptToUse = customPrompt || item.prompt;
    updateStatus(item.id, 'generating', undefined, undefined, customPrompt);
    try {
      const slotIndex = item.id - 1;
      const composition = compositionPlan[slotIndex]?.prompt;
      let billedCost = costPerImage;
      const generateRawImage = (scenarioPrompt: string) =>
        generateEmoticonImage(
          apiConfig,
          config.characterDescription,
          scenarioPrompt,
          config.style,
          config.referenceImage,
          composition
        );
      let rawImage = await generateRawImage(promptToUse);

      try {
        if (await detectImageClipping(rawImage)) {
          const safePrompt = `${promptToUse}\n\nComposition correction: leave at least 15px clear safe margin around every part of the character, props, and in-image text. Do not crop or cut off any outline, hand, foot, ear, speech mark, or calligraphy.`;
          billedCost += costPerImage;
          updateStatus(item.id, 'generating', undefined, undefined, safePrompt);
          rawImage = await generateRawImage(safePrompt);
        }
      } catch (clipError) {
        console.warn(`Clipping detection skipped for ID ${item.id}`, clipError);
      }

      const processedImage = await processImageForOutput(rawImage);
      updateStatus(item.id, 'completed', processedImage, undefined, undefined, billedCost);
    } catch (err) {
      console.error(`Failed ID ${item.id}`, err);
      updateStatus(item.id, 'failed', undefined, 'Generation failed');
    }
  }, [apiConfig, config, compositionPlan, costPerImage, updateStatus]);

  // Initialize emoticons list
  useEffect(() => {
    if (prompts.length > 0 && !initialized.current) {
      initialized.current = true;
      const safePrompts = prompts.slice(0, 24);

      const initial: EmoticonWithCost[] = safePrompts.map((prompt, idx) => ({
        id: idx + 1,
        prompt: prompt || `Sticker ${idx + 1}`,
        imageUrl: null,
        status: 'pending',
        cost: 0,
      }));
      setEmoticons(initial);
    }
  }, [prompts]);

  const startGeneration = useCallback(async (items: EmoticonWithCost[], parallel: number) => {
    setIsGenerating(true);
    setHasStarted(true);
    abortRef.current = false;

    const pendingItems = items.filter((item) => item.status === 'pending' || item.status === 'failed');

    if (parallel === 1) {
      // Sequential processing
      for (const item of pendingItems) {
        if (abortRef.current) break;
        await processItem(item);
      }
    } else {
      // Parallel processing with concurrency limit
      const queue = [...pendingItems];
      const runningPromises: Promise<void>[] = [];

      const processNext = async (): Promise<void> => {
        while (queue.length > 0 && !abortRef.current) {
          const item = queue.shift();
          if (item) {
            await processItem(item);
          }
        }
      };

      // Start workers up to parallel count
      for (let i = 0; i < Math.min(parallel, queue.length); i++) {
        runningPromises.push(processNext());
      }

      await Promise.all(runningPromises);
    }

    setIsGenerating(false);
  }, [processItem]);

  const handleStartGeneration = () => {
    startGeneration(emoticons, parallelCount);
  };

  const handlePauseGeneration = () => {
    abortRef.current = true;
    setIsGenerating(false);
  };

  const handleResumeGeneration = () => {
    const pendingItems = emoticons.filter((item) => item.status === 'pending');
    if (pendingItems.length > 0) {
      startGeneration(emoticons, parallelCount);
    }
  };

  const handleUpdateAndRetry = async (id: number, newPrompt: string) => {
    const item = emoticons.find((e) => e.id === id);
    if (item) {
      setEditingItem(null);
      await processItem(item, newPrompt);
    }
  };

  const handleDownload = (item: EmoticonWithCost) => {
    if (item.imageUrl) {
      downloadImage(item.imageUrl, `sticker_${item.id}.png`);
    }
  };

  const handleDownloadMainOnly = async (item: EmoticonWithCost) => {
    if (!item.imageUrl) return;
    try {
      const mainImage = await buildOgqMainImage(item.imageUrl);
      downloadImage(mainImage, `main_${item.id}.png`);
    } catch {
      alert('메인 이미지 생성에 실패했습니다.');
    }
  };

  const handleApplyOutline = (newDataUrl: string, itemId: number) => {
    setEmoticons((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, imageUrl: newDataUrl } : item
      )
    );
  };

  const handleDownloadAllZip = async () => {
    const zip = new JSZip();
    let hasImages = false;

    emoticons.forEach((item) => {
      if (item.imageUrl && item.status === 'completed') {
        const base64Data = dataUrlToBase64(item.imageUrl);
        const filename = `sticker_${item.id.toString().padStart(2, '0')}.png`;
        zip.file(filename, base64Data, { base64: true });
        hasImages = true;
      }
    });

    if (!hasImages) {
      alert('다운로드할 이모티콘이 없습니다.');
      return;
    }

    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'emoticons.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating zip:', error);
      alert('ZIP 파일 생성에 실패했습니다.');
    }
  };

  const handleDownloadOgqPackage = async (mainIndex: number) => {
    const completed = emoticons.filter(
      (e) => e.status === 'completed' && e.imageUrl
    );

    if (completed.length < OGQ_REQUIRED_STICKERS) {
      const proceed = window.confirm(
        `OGQ 제출에는 ${OGQ_REQUIRED_STICKERS}장이 필요합니다. 현재 ${completed.length}장만 완성되어 있습니다. 그래도 패키지를 만들까요?`
      );
      if (!proceed) return;
    }

    const main = completed[mainIndex] ?? completed[0];
    if (!main || !main.imageUrl) {
      alert('OGQ 패키지를 만들 완성된 이미지가 없습니다.');
      return;
    }

    try {
      const zip = new JSZip();
      const stickers = zip.folder('stickers');
      if (!stickers) throw new Error('Failed to create stickers folder');

      completed.slice(0, OGQ_REQUIRED_STICKERS).forEach((item, idx) => {
        stickers.file(
          `${idx + 1}.png`,
          dataUrlToBase64(item.imageUrl as string),
          { base64: true }
        );
      });

      const tabSources = completed.slice(0, 4);
      const [mainImage, ...tabImages] = await Promise.all([
        buildOgqMainImage(main.imageUrl),
        ...tabSources.map((item) => buildOgqTabImage(item.imageUrl as string)),
      ]);
      zip.file('main.png', dataUrlToBase64(mainImage), { base64: true });
      tabImages.forEach((tabImage, idx) => {
        zip.file(`tab_${idx + 1}.png`, dataUrlToBase64(tabImage), { base64: true });
      });

      const readme = [
        'OGQ Creators Studio 제출 패키지',
        '',
        `스티커: stickers/1.png ~ ${OGQ_REQUIRED_STICKERS}.png (740x640)`,
        '메인 이미지: main.png (240x240)',
        `탭 이미지: tab_1.png ~ tab_${tabImages.length}.png (96x74)`,
        '',
        '검토 체크리스트:',
        '- [ ] 24장 모두 캐릭터 일관성 확인',
        '- [ ] 감정/동작 중복 없음',
        '- [ ] 흰 가장자리/그림자 없음',
        '- [ ] 메인/탭 이미지의 캐릭터가 스티커와 동일',
      ].join('\n');
      zip.file('README.txt', readme);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ogq-submission.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating OGQ package:', error);
      alert('OGQ 패키지 생성에 실패했습니다.');
    }
  };

  const duplicateGroups = useMemo(
    () => findDuplicatePrompts(prompts),
    [prompts]
  );

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(3)}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-20">
      {/* Header with Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-800">
              {isComplete && failedCount === 0
                ? '생성 완료!'
                : isGenerating
                ? '이모티콘 생성 중...'
                : hasStarted
                ? '일시 정지됨'
                : '생성 준비 완료'}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <span className="text-slate-500">
                {completedCount} / {totalCount} 완료
                {generatingCount > 0 && (
                  <span className="text-indigo-500 ml-1">({generatingCount}개 생성중)</span>
                )}
              </span>
              {failedCount > 0 && (
                <span className="text-red-500 font-medium">
                  {failedCount}개 실패
                </span>
              )}
            </div>
          </div>

          {/* Cost Display */}
          <div className="flex items-center gap-6 bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3 rounded-xl border border-indigo-100">
            <div className="text-center">
              <div className="text-xs font-medium text-slate-500 mb-0.5">현재 비용</div>
              <div className="text-2xl font-bold text-indigo-600">{formatCost(totalCost)}</div>
            </div>
            <div className="w-px h-10 bg-indigo-200"></div>
            <div className="text-center">
              <div className="text-xs font-medium text-slate-500 mb-0.5">예상 총 비용</div>
              <div className="text-2xl font-bold text-slate-700">{formatCost(estimatedTotalCost)}</div>
            </div>
            <div className="w-px h-10 bg-indigo-200"></div>
            <div className="text-center">
              <div className="text-xs font-medium text-slate-500 mb-0.5">이미지당</div>
              <div className="text-xl font-bold text-purple-600">{formatCost(costPerImage)}</div>
            </div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-4 pt-4 border-t border-slate-100">
          {/* Parallel Processing Slider */}
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">병렬 처리</span>
            </div>
            <div className="flex-1 flex items-center gap-3 max-w-xs">
              <input
                type="range"
                min="1"
                max="24"
                value={parallelCount}
                onChange={(e) => setParallelCount(Number(e.target.value))}
                disabled={isGenerating}
                className="flex-1 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
                  [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-indigo-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
              />
              <div className="flex items-center justify-center min-w-[2.5rem] px-2 py-1 bg-indigo-100 rounded-md">
                <span className="text-sm font-bold text-indigo-700">{parallelCount}</span>
                <span className="text-[10px] text-indigo-500 ml-0.5">개</span>
              </div>
            </div>
          </div>

          <label className="inline-flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={useDarkPreview}
              onChange={(e) => setUseDarkPreview(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-slate-800"
            />
            <span>다크 배경</span>
          </label>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!hasStarted ? (
              <button
                onClick={handleStartGeneration}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                생성 시작
              </button>
            ) : isGenerating ? (
              <button
                onClick={handlePauseGeneration}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 shadow-md transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                일시 정지
              </button>
            ) : !isComplete ? (
              <button
                onClick={handleResumeGeneration}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow-md transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                계속하기
              </button>
            ) : null}

            {completedCount > 0 && (
              <>
                <button
                  onClick={handleDownloadAllZip}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-md flex items-center gap-2 transition-all"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    ></path>
                  </svg>
                  ZIP
                </button>
                <button
                  onClick={() => handleDownloadOgqPackage(0)}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 shadow-md flex items-center gap-2 transition-all"
                  title="OGQ 제출용: 24장 + 메인 + 탭 이미지 자동 생성"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  OGQ 패키지
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <RecommendationCards
        apiConfig={apiConfig}
        config={config}
        prompts={prompts}
      />

      {/* Settings Accordion - Only show before generation starts */}
      {!hasStarted && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg className={`w-5 h-5 text-slate-400 transition-transform ${settingsOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium text-slate-700">생성 설정 확인 및 수정</span>
              <span className="text-xs text-slate-400">캐릭터, 스타일, 시나리오</span>
            </div>
            <div className="flex items-center gap-2">
              {config.referenceImage && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">참조 이미지 있음</span>
              )}
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">{prompts.length}개 프롬프트</span>
            </div>
          </button>

          {settingsOpen && (
            <div className="border-t border-slate-100 p-6 space-y-6 animate-fade-in">
              {/* Character Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  캐릭터 설명
                </label>
                <textarea
                  value={config.characterDescription}
                  onChange={(e) => onConfigUpdate({ ...config, characterDescription: e.target.value })}
                  className="w-full p-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none resize-none h-32 text-base"
                  placeholder="캐릭터 설명..."
                />
              </div>

              {/* Style */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  아트 스타일
                </label>
                <input
                  type="text"
                  value={config.style}
                  onChange={(e) => onConfigUpdate({ ...config, style: e.target.value })}
                  className="w-full p-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-base"
                  placeholder="예: 플랫 벡터, 스티커 스타일..."
                />
              </div>

              {/* Reference Image Preview */}
              {config.referenceImage && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    참조 이미지
                  </label>
                  <div className="flex items-start gap-4">
                    <img
                      src={config.referenceImage}
                      alt="Reference"
                      className="w-32 h-32 object-contain rounded-lg border border-slate-200 bg-slate-50"
                    />
                    <button
                      onClick={() => onConfigUpdate({ ...config, referenceImage: null })}
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      이미지 제거
                    </button>
                  </div>
                </div>
              )}

              {/* Prompts List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700">
                    시나리오 프롬프트 ({prompts.length}개)
                  </label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 p-1">
                  {prompts.map((prompt, index) => (
                    <div key={index} className="relative">
                      <span className="absolute top-2 left-2 w-6 h-6 bg-slate-700 text-white text-xs font-bold rounded flex items-center justify-center z-10">
                        {index + 1}
                      </span>
                      <textarea
                        value={prompt}
                        onChange={(e) => {
                          const newPrompts = [...prompts];
                          newPrompts[index] = e.target.value;
                          onPromptsUpdate(newPrompts);
                          // Also update emoticons list
                          setEmoticons(prev => prev.map((item, i) =>
                            i === index ? { ...item, prompt: e.target.value } : item
                          ));
                        }}
                        className="w-full pl-10 pr-3 py-3 text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none h-24"
                        placeholder={`프롬프트 ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ease-out ${
            failedCount > 0 ? 'bg-orange-500' : 'bg-indigo-600'
          }`}
          style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
        ></div>
      </div>

      <OutlinePackager
  stickers={emoticons
    .filter((e) => e.status === 'completed' && e.imageUrl)
    .map((e) => e.imageUrl as string)}
/> 

      {/* Composition plan preview */}
      {!hasStarted && compositionPlan.length > 0 && (
        <details className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl overflow-hidden">
          <summary className="px-5 py-4 cursor-pointer hover:bg-indigo-100/40 transition-colors flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 6h16M4 6a2 2 0 00-2 2v8a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2" />
              </svg>
              <div>
                <p className="font-semibold text-slate-800">
                  화각 분산 계획 ({compositionSummary.length}종 × 총 {compositionPlan.length}컷)
                </p>
                <p className="text-xs text-slate-500">
                  バストアップ · アオリ · フカン 등 일본 일러스트/시네마 기법을 슬롯별 자동 배정 → OGQ 반려 사유(같은 화각 반복) 사전 차단
                </p>
              </div>
            </div>
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-5 pb-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {compositionSummary.map((s) => (
                <span
                  key={s.label}
                  className="px-3 py-1 bg-white rounded-full border border-indigo-200 text-xs text-slate-700"
                >
                  <span className="font-semibold text-indigo-700">{s.count}</span>
                  <span className="text-slate-400 mx-1">×</span>
                  {s.label}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
              {compositionPlan.map((c, i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-lg p-2"
                >
                  <div className="font-bold text-slate-400">#{i + 1}</div>
                  <div className="text-slate-700 line-clamp-1">{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* OGQ duplicate warning */}
      {!hasStarted && duplicateGroups.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-amber-800 mb-1">
                유사 프롬프트 감지 ({duplicateGroups.length}개 그룹)
              </p>
              <p className="text-amber-700 mb-2">
                OGQ 심사에서 비슷한 감정/동작 반복은 반려 사유가 됩니다. 생성 전에 차별화를 권장합니다.
              </p>
              <ul className="space-y-1">
                {duplicateGroups.map((group, i) => (
                  <li key={i} className="text-amber-700">
                    <span className="font-mono text-xs bg-amber-100 rounded px-1.5 py-0.5 mr-2">
                      #{group.indices.map((idx) => idx + 1).join(', #')}
                    </span>
                    유사도 {Math.round(group.similarity * 100)}%
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {emoticons.map((item) => (
          <div
            key={item.id}
            className={`relative aspect-square ${previewCardClass} rounded-xl border transition-all overflow-hidden
              ${
                item.status === 'failed'
                  ? 'border-red-300 shadow-red-100'
                  : 'border-slate-200 shadow-sm hover:shadow-md'
              } group`}
          >
            {item.status === 'pending' && (
              <div className={`absolute inset-0 flex items-center justify-center ${placeholderClass}`}>
                <span className="text-sm font-medium">
                  대기중...
                </span>
              </div>
            )}

            {item.status === 'generating' && (
              <div className={`absolute inset-0 flex flex-col items-center justify-center ${generatingSurfaceClass} backdrop-blur-sm z-10`}>
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-2"></div>
                <span className="text-xs font-bold">
                  생성중...
                </span>
              </div>
            )}

            {item.status === 'failed' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 text-red-500 p-2 text-center">
                <svg
                  className="w-8 h-8 mb-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  ></path>
                </svg>
                <span className="text-xs font-bold mb-2">실패</span>
                <button
                  onClick={() => setEditingItem(item)}
                  className="px-3 py-1 bg-white border border-red-200 rounded text-[10px] font-bold shadow-sm hover:bg-red-100 transition-colors"
                >
                  수정 & 재시도
                </button>
              </div>
            )}

            {item.imageUrl && (
              <>
                <img
                  src={item.imageUrl}
                  alt={item.prompt}
                  className="w-full h-full object-contain p-2"
                />

                {/* ID Badge */}
                <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm z-10">
                  #{item.id}
                </div>

                {/* Cost Badge */}
                {item.cost !== undefined && item.cost > 0 && (
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-md backdrop-blur-sm z-10">
                    {formatCost(item.cost)}
                  </div>
                )}

                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 space-y-2 z-20">
                  <p className="text-white text-[10px] font-medium line-clamp-3 leading-tight text-center opacity-90 mb-1">
                    {item.prompt}
                  </p>

                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => setEditingItem(item)}
                      className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1 border border-white/20"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                      </svg>
                      수정
                    </button>
                    <button
                      onClick={() => setOutlineItem(item)}
                      className="bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1 shadow-lg shadow-purple-500/20"
                      title="PNG 외곽선 추가"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h4a1 1 0 010 2H6.414l8 8H15a1 1 0 110 2h-4a1 1 0 01-.707-.293l-9-9A1 1 0 014 5zm14 0a1 1 0 10-2 0v4a1 1 0 00.293.707l5 5a1 1 0 001.414-1.414L19 9.586V5z"></path>
                      </svg>
                      외곽선
                    </button>
                    <button
                      onClick={() => handleDownloadMainOnly(item)}
                      className="bg-teal-500 hover:bg-teal-600 text-white text-[10px] font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1 shadow-lg shadow-teal-500/20"
                      title="메인 이미지 다운로드 (240×240)"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                      메인
                    </button>
                    <button
                      onClick={() => handleDownload(item)}
                      className="bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1 shadow-lg shadow-indigo-500/20"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                      </svg>
                      저장
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-800">
                  스티커 #{editingItem.id} 수정
                </h3>
                <button
                  onClick={() => setEditingItem(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  프롬프트
                </label>
                <textarea
                  autoFocus
                  id="modal-prompt-input"
                  className="w-full p-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none resize-none h-32 text-slate-700"
                  defaultValue={editingItem.prompt}
                />
              </div>

              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-500">
                재생성 시 {formatCost(costPerImage)} 비용이 발생합니다.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingItem(null)}
                  className="flex-1 px-4 py-3 rounded-xl font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    const input = document.getElementById(
                      'modal-prompt-input'
                    ) as HTMLTextAreaElement;
                    handleUpdateAndRetry(editingItem.id, input.value);
                  }}
                  className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                  재생성
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Outline Modal */}
      {outlineItem && outlineItem.imageUrl && (
        <OutlineModal
          imageUrl={outlineItem.imageUrl}
          itemId={outlineItem.id}
          onClose={() => setOutlineItem(null)}
          onSave={handleApplyOutline}
        />
      )}

      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
