'use client';

import { useEffect, useMemo, useState } from 'react';
import { TEXT_MODELS } from '@/constants';
import { ApiConfig, GenerationConfig } from '@/types';

interface Props {
  apiConfig: ApiConfig;
  config: GenerationConfig;
  prompts: string[];
}

interface TitleRecommendation {
  characterNames: string[];
  titles: string[];
  usedModel?: string;
}

interface MetadataRecommendation {
  description: string;
  tags: string[];
  usedModel?: string;
}

const TONES = ['따뜻한', '귀여운', '감성적인', '재치있는', '깔끔한'];

const isTextProvider = (
  provider: ApiConfig['provider']
): provider is 'gemini' | 'openai' =>
  provider === 'gemini' || provider === 'openai';

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || '추천 생성에 실패했습니다.';
  } catch {
    return '추천 생성에 실패했습니다.';
  }
};

const copyText = async (text: string) => {
  if (!text.trim()) return;
  await navigator.clipboard.writeText(text);
};

export default function RecommendationCards({
  apiConfig,
  config,
  prompts,
}: Props) {
  const textModels = useMemo(
    () =>
      isTextProvider(apiConfig.provider)
        ? [...TEXT_MODELS[apiConfig.provider]]
        : [],
    [apiConfig.provider]
  );
  const [textModel, setTextModel] = useState<string>(textModels[0]?.id || '');
  const [titleExample, setTitleExample] = useState(
    '몽실한 토끼 캐릭터라면 "몽실이의 포근한 하루" 같은 방향'
  );
  const [metadataExample, setMetadataExample] = useState(
    '따뜻하고 귀여운 톤으로, 일상 대화에서 쓰기 좋은 설명과 태그'
  );
  const [metadataTitle, setMetadataTitle] = useState('');
  const [tone, setTone] = useState(TONES[0]);
  const [titleResult, setTitleResult] = useState<TitleRecommendation | null>(
    null
  );
  const [metadataResult, setMetadataResult] =
    useState<MetadataRecommendation | null>(null);
  const [titleError, setTitleError] = useState('');
  const [metadataError, setMetadataError] = useState('');
  const [isTitleLoading, setIsTitleLoading] = useState(false);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);

  useEffect(() => {
    setTextModel(textModels[0]?.id || '');
  }, [textModels]);

  const canRecommend =
    isTextProvider(apiConfig.provider) && apiConfig.apiKey.trim().length > 0;

  const requestBase = {
    characterDescription: config.characterDescription,
    style: config.style,
    prompts,
    apiConfig,
    textModel,
  };

  const recommendTitle = async () => {
    setIsTitleLoading(true);
    setTitleError('');
    try {
      const response = await fetch('/api/recommend-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestBase,
          exampleInput: titleExample,
        }),
      });

      if (!response.ok) throw new Error(await getErrorMessage(response));
      const data = (await response.json()) as TitleRecommendation;
      setTitleResult(data);
      setMetadataTitle(data.titles[0] || metadataTitle);
    } catch (error) {
      setTitleError(
        error instanceof Error ? error.message : '추천 생성에 실패했습니다.'
      );
    } finally {
      setIsTitleLoading(false);
    }
  };

  const recommendMetadata = async () => {
    setIsMetadataLoading(true);
    setMetadataError('');
    try {
      const response = await fetch('/api/recommend-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestBase,
          title: metadataTitle,
          tone,
          exampleInput: metadataExample,
        }),
      });

      if (!response.ok) throw new Error(await getErrorMessage(response));
      const data = (await response.json()) as MetadataRecommendation;
      setMetadataResult(data);
    } catch (error) {
      setMetadataError(
        error instanceof Error ? error.message : '추천 생성에 실패했습니다.'
      );
    } finally {
      setIsMetadataLoading(false);
    }
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              제목·캐릭터 이름
            </h3>
            <p className="text-xs text-slate-500 mt-1">추천 모델 {textModel}</p>
          </div>
          <select
            value={textModel}
            onChange={(event) => setTextModel(event.target.value)}
            disabled={!canRecommend}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
          >
            {textModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={titleExample}
          onChange={(event) => setTitleExample(event.target.value)}
          className="w-full h-20 rounded-lg border border-slate-200 p-3 text-sm outline-none resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="예시 입력"
        />

        <button
          onClick={recommendTitle}
          disabled={!canRecommend || isTitleLoading}
          className="w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {isTitleLoading ? '추천 중...' : '이름·제목 추천'}
        </button>

        {titleError && (
          <p className="text-sm font-medium text-red-600">{titleError}</p>
        )}

        {titleResult && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">캐릭터 이름</p>
              <div className="flex flex-wrap gap-2">
                {titleResult.characterNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => copyText(name)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-500">세트 제목</p>
              <div className="space-y-2">
                {titleResult.titles.map((title) => (
                  <button
                    key={title}
                    onClick={() => {
                      setMetadataTitle(title);
                      copyText(title);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
                  >
                    {title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">설명·태그</h3>
            <p className="text-xs text-slate-500 mt-1">
              설명 130~155자 · 태그 15개
            </p>
          </div>
          <input
            value={metadataTitle}
            onChange={(event) => setMetadataTitle(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            placeholder="세트 제목"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {TONES.map((item) => (
            <button
              key={item}
              onClick={() => setTone(item)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                tone === item
                  ? 'bg-slate-800 border-slate-800 text-white'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <textarea
          value={metadataExample}
          onChange={(event) => setMetadataExample(event.target.value)}
          className="w-full h-20 rounded-lg border border-slate-200 p-3 text-sm outline-none resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          placeholder="예시 입력"
        />

        <button
          onClick={recommendMetadata}
          disabled={!canRecommend || isMetadataLoading}
          className="w-full h-10 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          {isMetadataLoading ? '추천 중...' : '설명·태그 추천'}
        </button>

        {metadataError && (
          <p className="text-sm font-medium text-red-600">{metadataError}</p>
        )}

        {metadataResult && (
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-xs font-bold text-slate-500">
                  {metadataResult.description.length}자
                </span>
                <button
                  onClick={() => copyText(metadataResult.description)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  복사
                </button>
              </div>
              <p className="text-sm leading-6 text-slate-700">
                {metadataResult.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {metadataResult.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => copyText(tag)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  #{tag}
                </button>
              ))}
            </div>
            <button
              onClick={() => copyText(metadataResult.tags.join(', '))}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              태그 전체 복사
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
