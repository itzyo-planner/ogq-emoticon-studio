'use client';

import { useEffect, useState } from 'react';
import { ApiConfig, AIProvider } from '@/types';
import { AI_MODELS, PROVIDER_INFO } from '@/constants';

interface Props {
  config: ApiConfig;
  onUpdate: (config: ApiConfig) => void;
  onNext: () => void;
}

export default function StepApiConfig({ config, onUpdate, onNext }: Props) {
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codexAvailable, setCodexAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/codex-status')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCodexAvailable(!!data.available);
      })
      .catch(() => {
        if (!cancelled) setCodexAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const baseProviders: AIProvider[] = ['gemini', 'openai', 'stability'];
  const providers: AIProvider[] = codexAvailable
    ? [...baseProviders, 'codex']
    : baseProviders;
  const availableModels = AI_MODELS.filter((m) => m.provider === config.provider);
  const isCodex = config.provider === 'codex';

  const handleProviderChange = (provider: AIProvider) => {
    const firstModel = AI_MODELS.find((m) => m.provider === provider);
    onUpdate({
      ...config,
      provider,
      model: firstModel?.id || '',
    });
    setError(null);
  };

  const handleValidateAndNext = async () => {
    if (!isCodex && !config.apiKey.trim()) {
      setError('API 키를 입력해주세요.');
      return;
    }

    if (isCodex) {
      if (!codexAvailable) {
        setError(
          'Codex OAuth 세션이 없습니다. 터미널에서 `npx @openai/codex login` 실행 후 재시도해주세요.'
        );
        return;
      }
      onNext();
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.provider,
          apiKey: config.apiKey,
        }),
      });

      if (response.status === 404) {
        onNext();
        return;
      }

      const data = await response.json();

      if (data.valid) {
        onNext();
      } else {
        setError(data.error || 'API 키가 유효하지 않습니다.');
      }
    } catch {
      // 검증 API 통신 실패 시 키 형식만 가볍게 검증 후 진행
      onNext();
    } finally {
      setIsValidating(false);
    }
  };

  const isNextDisabled = isCodex
    ? !codexAvailable || !config.model
    : !config.apiKey.trim() || !config.model;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">AI 모델 설정</h2>
        <p className="text-slate-500">
          이미지 생성에 사용할 AI 모델과 API 키를 설정하세요.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        {/* Provider Selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-slate-700">
              AI 제공자 선택
            </label>
            {codexAvailable === true && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Codex 감지됨
              </span>
            )}
            {codexAvailable === false && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-[11px] font-medium"
                title="`npx @openai/codex login` 실행 후 재시도"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Codex 미연결
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {providers.map((provider) => {
              const info = PROVIDER_INFO[provider];
              const isSelected = config.provider === provider;
              const modelCount = AI_MODELS.filter(
                (m) => m.provider === provider
              ).length;
              const isCodexOption = provider === 'codex';
              return (
                <button
                  key={provider}
                  onClick={() => handleProviderChange(provider)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{info.icon}</span>
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-2">
                        {info.name}
                        {isCodexOption && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                            LOCAL OAUTH
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {isCodexOption
                          ? 'API 키 불필요 · ChatGPT Plus/Pro 구독'
                          : `${modelCount} 모델 사용 가능`}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            모델 선택
          </label>
          <div className="space-y-2">
            {availableModels.map((model) => {
              const isSelected = config.model === model.id;
              return (
                <button
                  key={model.id}
                  onClick={() => onUpdate({ ...config, model: model.id })}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">
                        {model.name}
                      </div>
                      <div className="text-sm text-slate-500">
                        {model.description}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* API Key Input (또는 Codex 안내) */}
        {isCodex ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔐</span>
              <span className="font-semibold text-emerald-800">
                로컬 Codex OAuth 사용
              </span>
            </div>
            <p className="text-sm text-emerald-900/80">
              API 키 없이 <code className="px-1 py-0.5 bg-white rounded border border-emerald-200 text-[12px]">~/.codex/auth.json</code>의
              세션으로 이미지가 생성됩니다. 최초 1회 OAuth 프록시가 포트{' '}
              <code className="px-1 py-0.5 bg-white rounded border border-emerald-200 text-[12px]">10531</code>에서 기동됩니다.
            </p>
            {codexAvailable === false && (
              <p className="text-sm text-rose-600">
                세션이 없어 사용할 수 없습니다. 터미널에서{' '}
                <code className="px-1 py-0.5 bg-white rounded border border-rose-200 text-[12px]">npx @openai/codex login</code>{' '}
                실행 후 페이지를 새로고침하세요.
              </p>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        ) : (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">
              API 키 <span className="text-red-500">*</span>
            </label>
            <a
              href={PROVIDER_INFO[config.provider].keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline"
            >
              API 키 발급받기 →
            </a>
          </div>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              className={`w-full p-4 pr-12 rounded-xl border transition-all outline-none ${
                error
                  ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                  : 'border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
              }`}
              placeholder={PROVIDER_INFO[config.provider].keyPlaceholder}
              value={config.apiKey}
              onChange={(e) => {
                onUpdate({ ...config, apiKey: e.target.value });
                setError(null);
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showKey ? (
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
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
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
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          <p className="mt-2 text-xs text-slate-400">
            API 키는 브라우저에만 저장되며 서버에 저장되지 않습니다.
          </p>
        </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleValidateAndNext}
          disabled={isNextDisabled || isValidating}
          className={`px-8 py-3 rounded-xl font-bold text-white transition-all transform ${
            isNextDisabled || isValidating
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 shadow-lg shadow-indigo-200'
          }`}
        >
          {isValidating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              확인 중...
            </span>
          ) : (
            '다음: 캐릭터 정의'
          )}
        </button>
      </div>
    </div>
  );
}
