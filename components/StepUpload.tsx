'use client';

import { useRef, useState } from 'react';
import { ApiConfig, GenerationConfig } from '@/types';
import { ART_STYLE_OPTIONS } from '@/constants';
import { generateEmoticonImage } from '@/lib/api';
import {
  CharacterHistoryItem,
  useCharacterHistory,
} from '@/hooks/useCharacterHistory';

interface Props {
  apiConfig: ApiConfig;
  config: GenerationConfig;
  onUpdate: (config: GenerationConfig) => void;
  onNext: () => void;
}

interface CharacterSample {
  id: number;
  imageUrl: string;
  prompt: string;
}

interface CharacterSampleFile {
  version: 1;
  savedAt: string;
  characterDescription: string;
  style: string;
  samples: CharacterSample[];
}

const DEFAULT_STYLE = ART_STYLE_OPTIONS[0];

const splitStyle = (style: string): { selected: string[]; custom: string } => {
  const selected = ART_STYLE_OPTIONS.filter((option) => style.includes(option));
  const custom = style
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !ART_STYLE_OPTIONS.includes(part))
    .join(', ');

  return {
    selected: selected.length > 0 ? selected : [DEFAULT_STYLE],
    custom,
  };
};

const buildStyle = (selected: string[], custom: string): string =>
  [...selected, custom.trim()].filter(Boolean).join(', ');

export default function StepUpload({
  apiConfig,
  config,
  onUpdate,
  onNext,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sampleFileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(config.referenceImage);
  const [showHistory, setShowHistory] = useState(false);
  const [samples, setSamples] = useState<CharacterSample[]>([]);
  const [isGeneratingSamples, setIsGeneratingSamples] = useState(false);
  const initialStyle = splitStyle(config.style);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(
    initialStyle.selected
  );
  const [customStyle, setCustomStyle] = useState(initialStyle.custom);

  const { history, isLoaded, addToHistory, deleteFromHistory, clearHistory } =
    useCharacterHistory();

  const updateStyle = (nextSelected: string[], nextCustom = customStyle) => {
    setSelectedStyles(nextSelected);
    setCustomStyle(nextCustom);
    onUpdate({
      ...config,
      style: buildStyle(nextSelected, nextCustom),
    });
  };

  const applyLoadedStyle = (style: string) => {
    const parsed = splitStyle(style);
    setSelectedStyles(parsed.selected);
    setCustomStyle(parsed.custom);
    onUpdate({
      ...config,
      style: buildStyle(parsed.selected, parsed.custom),
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기가 너무 큽니다. 최대 10MB까지 업로드할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setPreview(result);
      onUpdate({ ...config, referenceImage: result });
    };
    reader.readAsDataURL(file);
  };

  const handleSelectHistory = (item: CharacterHistoryItem) => {
    const parsed = splitStyle(item.style);
    setSelectedStyles(parsed.selected);
    setCustomStyle(parsed.custom);
    onUpdate({
      ...config,
      characterDescription: item.characterDescription,
      style: buildStyle(parsed.selected, parsed.custom),
    });
    setShowHistory(false);
  };

  const toggleStyle = (style: string) => {
    const next = selectedStyles.includes(style)
      ? selectedStyles.filter((item) => item !== style)
      : [...selectedStyles, style];
    updateStyle(next.length > 0 ? next : [DEFAULT_STYLE]);
  };

  const generateCharacterSamples = async () => {
    if (!config.characterDescription.trim()) {
      alert('캐릭터 설명을 먼저 입력해주세요.');
      return;
    }

    if (apiConfig.provider !== 'codex' && !apiConfig.apiKey.trim()) {
      alert('샘플 생성을 위해 API 키가 필요합니다.');
      return;
    }

    setIsGeneratingSamples(true);
    try {
      const style = buildStyle(selectedStyles, customStyle);
      const prompts = [
        'Character sample option A, friendly neutral pose, full body, clean reference image',
        'Character sample option B, expressive standing pose, full body, clean reference image',
        'Character sample option C, cute mascot pose, full body, clean reference image',
      ];

      const generated = await Promise.all(
        prompts.map(async (prompt, index) => {
          const imageUrl = await generateEmoticonImage(
            apiConfig,
            config.characterDescription,
            prompt,
            style,
            null,
            'Centered full body character reference, safe margin, no cropping.'
          );
          return {
            id: index + 1,
            imageUrl,
            prompt,
          };
        })
      );

      setSamples(generated);
    } catch (error) {
      console.error('Character sample generation failed:', error);
      alert('캐릭터 샘플 생성에 실패했습니다.');
    } finally {
      setIsGeneratingSamples(false);
    }
  };

  const selectSample = (sample: CharacterSample) => {
    setPreview(sample.imageUrl);
    onUpdate({
      ...config,
      referenceImage: sample.imageUrl,
      style: buildStyle(selectedStyles, customStyle),
    });
  };

  const saveSamples = () => {
    if (samples.length === 0) {
      alert('저장할 캐릭터 샘플이 없습니다.');
      return;
    }

    const payload: CharacterSampleFile = {
      version: 1,
      savedAt: new Date().toISOString(),
      characterDescription: config.characterDescription,
      style: buildStyle(selectedStyles, customStyle),
      samples,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'character-samples.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadSamples = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result)) as CharacterSampleFile;
        if (!Array.isArray(payload.samples)) {
          throw new Error('Invalid sample file');
        }

        const parsed = splitStyle(payload.style || DEFAULT_STYLE);
        setSamples(payload.samples.slice(0, 3));
        setSelectedStyles(parsed.selected);
        setCustomStyle(parsed.custom);
        const firstImage = payload.samples[0]?.imageUrl ?? null;
        setPreview(firstImage);
        onUpdate({
          ...config,
          characterDescription:
            payload.characterDescription || config.characterDescription,
          style: buildStyle(parsed.selected, parsed.custom),
          referenceImage: firstImage,
        });
      } catch (error) {
        console.error('Character sample load failed:', error);
        alert('샘플 파일을 불러오지 못했습니다.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleNext = () => {
    if (config.characterDescription.trim()) {
      addToHistory(config.characterDescription, buildStyle(selectedStyles, customStyle));
    }
    onNext();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const isNextDisabled = !config.characterDescription && !config.referenceImage;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">1. 캐릭터 정의</h2>
        <p className="text-slate-500">
          캐릭터 설명, 참조 이미지, 아트 스타일을 정하고 샘플을 고릅니다.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                캐릭터 설명 <span className="text-red-500">*</span>
              </label>
              {isLoaded && history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  이전 기록 ({history.length})
                </button>
              )}
            </div>

            <textarea
              className="w-full p-4 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none resize-none h-32"
              placeholder="예: 빨간 나비넥타이를 한 노란 오리, 통통한 몸, 밝고 장난스러운 표정"
              value={config.characterDescription}
              onChange={(e) =>
                onUpdate({ ...config, characterDescription: e.target.value })
              }
            />

            {showHistory && history.length > 0 && (
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                  <span className="text-sm font-medium text-slate-600">
                    최근 사용한 캐릭터
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('모든 기록을 삭제하시겠습니까?')) {
                        clearHistory();
                      }
                    }}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    전체 삭제
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="group px-4 py-3 hover:bg-indigo-50 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors"
                      onClick={() => handleSelectHistory(item)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 line-clamp-2">
                            {item.characterDescription}
                          </p>
                          {item.style && (
                            <p className="text-xs text-slate-500 mt-1 truncate">
                              스타일: {item.style}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-400">
                              {formatDate(item.createdAt)}
                            </span>
                            {item.usedCount > 1 && (
                              <span className="text-xs text-indigo-500">
                                {item.usedCount}회 사용
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFromHistory(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                          title="삭제"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              아트 스타일 다중 선택
            </label>
            <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {ART_STYLE_OPTIONS.map((style) => {
                const checked = selectedStyles.includes(style);
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      checked
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="mr-2">{checked ? '✓' : '□'}</span>
                    {style}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
              placeholder="커스텀 스타일 추가 입력"
              value={customStyle}
              onChange={(e) => updateStyle(selectedStyles, e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              참조 이미지 업로드
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                preview
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {preview ? (
                <div className="relative group">
                  <img
                    src={preview}
                    alt="Reference"
                    className="h-48 object-contain rounded-md"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md text-white font-medium">
                    이미지 변경
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mx-auto mb-3">
                    +
                  </div>
                  <p className="text-slate-600 font-medium">
                    클릭하여 참조 이미지 업로드
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    PNG, JPG, JPEG (최대 10MB)
                  </p>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              캐릭터 샘플 3장
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              설명과 스타일로 후보 이미지를 만들고 원하는 샘플을 참조 이미지로 선택합니다.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((index) => {
              const sample = samples[index];
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => sample && selectSample(sample)}
                  disabled={!sample}
                  className={`aspect-square rounded-xl border overflow-hidden bg-slate-50 flex items-center justify-center transition-all ${
                    sample?.imageUrl === preview
                      ? 'border-indigo-500 ring-2 ring-indigo-200'
                      : 'border-slate-200 hover:border-indigo-300'
                  } ${!sample ? 'cursor-default' : ''}`}
                >
                  {sample ? (
                    <img
                      src={sample.imageUrl}
                      alt={`Sample ${index + 1}`}
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">
                      샘플 {index + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={generateCharacterSamples}
            disabled={isGeneratingSamples}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
              isGeneratingSamples
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
            }`}
          >
            {isGeneratingSamples ? '샘플 생성 중...' : '캐릭터 샘플 3장 생성'}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={saveSamples}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              샘플 파일 저장
            </button>
            <button
              type="button"
              onClick={() => sampleFileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              샘플 불러오기
            </button>
            <input
              ref={sampleFileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={loadSamples}
            />
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 leading-relaxed">
            현재 스타일:
            <br />
            <span className="text-slate-700">
              {buildStyle(selectedStyles, customStyle)}
            </span>
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={isNextDisabled}
          className={`px-8 py-3 rounded-xl font-bold text-white transition-all transform ${
            isNextDisabled
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 shadow-lg shadow-indigo-200'
          }`}
        >
          다음: 시나리오 선택
        </button>
      </div>
    </div>
  );
}
