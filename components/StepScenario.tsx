'use client';

import { useState } from 'react';
import { SCENARIOS, TEXT_MODELS } from '@/constants';
import { ApiConfig } from '@/types';

interface Props {
  onConfirm: (prompts: string[]) => void;
  apiConfig?: ApiConfig;
}

export default function StepScenario({ onConfirm, apiConfig }: Props) {
  const [mode, setMode] = useState<'select' | 'custom' | 'preset'>('select');
  const [emoticonCount, setEmoticonCount] = useState(24);
  const [customPrompts, setCustomPrompts] = useState<string[]>(
    Array(24)
      .fill('')
      .map((_, i) => `감정/동작 ${i + 1}`)
  );
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTextModel, setSelectedTextModel] = useState(() => {
    if (apiConfig?.provider === 'gemini') return TEXT_MODELS.gemini[0].id;
    if (apiConfig?.provider === 'openai') return TEXT_MODELS.openai[0].id;
    return '';
  });
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');

  // Preset selection state
  const [selectedPreset, setSelectedPreset] = useState<typeof SCENARIOS[0] | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [presetPrompts, setPresetPrompts] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isImprovingPrompts, setIsImprovingPrompts] = useState(false);
  const [improveThemeInput, setImproveThemeInput] = useState('');

  const textModels = TEXT_MODELS;

  const handlePresetSelect = (scenario: typeof SCENARIOS[0]) => {
    setSelectedPreset(scenario);
    setPresetPrompts([...scenario.prompts]);
    // Select all by default
    setSelectedIndices(new Set(scenario.prompts.map((_, i) => i)));
    setMode('preset');
  };

  const togglePromptSelection = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      // Only allow selection if prompt is not empty
      if (presetPrompts[index]?.trim()) {
        newSet.add(index);
      }
    }
    setSelectedIndices(newSet);
  };

  const selectAllPrompts = () => {
    // Only select non-empty prompts
    const nonEmptyIndices = presetPrompts
      .map((p, i) => (p.trim() ? i : -1))
      .filter((i) => i !== -1);
    setSelectedIndices(new Set(nonEmptyIndices));
  };

  const deselectAllPrompts = () => {
    setSelectedIndices(new Set());
  };

  const handlePresetPromptChange = (index: number, value: string) => {
    const newPrompts = [...presetPrompts];
    newPrompts[index] = value;
    setPresetPrompts(newPrompts);

    // Auto-deselect if empty or whitespace only
    if (!value.trim()) {
      const newSet = new Set(selectedIndices);
      newSet.delete(index);
      setSelectedIndices(newSet);
    }
  };

  const handlePresetConfirm = () => {
    if (selectedIndices.size > 0) {
      const selectedPromptsList = presetPrompts.filter((_, i) => selectedIndices.has(i));
      onConfirm(selectedPromptsList);
    }
  };

  const handleAIImprovePrompts = async () => {
    if (!apiConfig?.apiKey || apiConfig.provider === 'stability') {
      alert('AI 개선 기능은 Gemini 또는 OpenAI API가 필요합니다.');
      return;
    }

    const selectedPromptsList = presetPrompts.filter((_, i) => selectedIndices.has(i));
    if (selectedPromptsList.length === 0) {
      alert('개선할 프롬프트를 선택해주세요.');
      return;
    }

    setIsImprovingPrompts(true);
    try {
      const response = await fetch('/api/improve-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompts: selectedPromptsList,
          theme: improveThemeInput.trim() || undefined,
          apiConfig,
          textModel: selectedTextModel,
        }),
      });

      const data = await response.json();
      if (data.prompts) {
        // Update only selected prompts
        const newPrompts = [...presetPrompts];
        let improvedIndex = 0;
        const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
        sortedIndices.forEach((i) => {
          if (improvedIndex < data.prompts.length) {
            newPrompts[i] = data.prompts[improvedIndex];
            improvedIndex++;
          }
        });
        setPresetPrompts(newPrompts);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Failed to improve prompts:', error);
      alert('프롬프트 개선에 실패했습니다.');
    } finally {
      setIsImprovingPrompts(false);
    }
  };

  const handleCustomChange = (index: number, value: string) => {
    const newPrompts = [...customPrompts];
    newPrompts[index] = value;
    setCustomPrompts(newPrompts);
  };

  const handleCountChange = (count: number) => {
    setEmoticonCount(count);
    // Adjust customPrompts array size
    if (count > customPrompts.length) {
      const newPrompts = [...customPrompts];
      for (let i = customPrompts.length; i < count; i++) {
        newPrompts.push(`감정/동작 ${i + 1}`);
      }
      setCustomPrompts(newPrompts);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPromptInput.trim()) {
      alert('프롬프트를 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: aiPromptInput,
          apiConfig,
          textModel: selectedTextModel,
          count: emoticonCount,
        }),
      });

      const data = await response.json();
      if (data.prompts && data.prompts.length >= emoticonCount) {
        setCustomPrompts(data.prompts.slice(0, emoticonCount));
      } else if (data.prompts) {
        // Fill remaining with defaults if not enough
        const filledPrompts = [...data.prompts];
        while (filledPrompts.length < emoticonCount) {
          filledPrompts.push(`감정/동작 ${filledPrompts.length + 1}`);
        }
        setCustomPrompts(filledPrompts);
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Failed to generate prompts:', error);
      alert('프롬프트 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Preset mode - select/deselect prompts from a preset scenario
  if (mode === 'preset' && selectedPreset) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{selectedPreset.icon}</span>
            <div>
              <h2 className="text-3xl font-bold text-slate-800">
                {selectedPreset.title}
              </h2>
              <p className="text-slate-500 mt-1">
                {selectedPreset.description}
              </p>
            </div>
          </div>
        </div>

        {/* Selection Controls */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-bold text-slate-800">
                이모티콘 선택
                <span className="ml-2 text-indigo-600">{selectedIndices.size}</span>
                <span className="text-slate-400">/{presetPrompts.length}개</span>
              </h3>
              <p className="text-sm text-slate-500">체크박스로 선택/해제, 텍스트 클릭으로 수정</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={selectAllPrompts}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
              >
                전체 선택
              </button>
              <button
                onClick={deselectAllPrompts}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                전체 해제
              </button>
            </div>
          </div>
        </div>

        {/* AI Improve Section - Accordion */}
        {apiConfig?.provider && apiConfig.provider !== 'stability' && (
          <details className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl border border-purple-100 overflow-hidden">
            <summary className="p-5 cursor-pointer hover:bg-purple-100/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800">AI로 선택된 프롬프트 개선</h3>
                  <p className="text-xs text-slate-500">테마를 입력하면 해당 스타일로 개선됩니다</p>
                </div>
                <svg className="w-5 h-5 text-slate-400 transition-transform [[open]>&]:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </summary>

            <div className="px-5 pb-5 space-y-3">
              <input
                type="text"
                value={improveThemeInput}
                onChange={(e) => setImproveThemeInput(e.target.value)}
                placeholder="예: 귀여운 고양이 캐릭터, 픽셀 아트 스타일..."
                className="w-full px-4 py-3 rounded-xl border border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm bg-white"
                disabled={isImprovingPrompts}
              />

              {/* Model Selector */}
              <details className="text-xs">
                <summary className="font-medium text-slate-500 cursor-pointer hover:text-slate-700">
                  텍스트 생성 모델 설정 ▾
                </summary>
                <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200">
                  <div className="flex flex-wrap gap-2">
                    {textModels[apiConfig.provider as 'gemini' | 'openai']?.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedTextModel(model.id);
                          setIsCustomModel(false);
                        }}
                        disabled={isImprovingPrompts}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                          selectedTextModel === model.id && !isCustomModel
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        } ${isImprovingPrompts ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {model.name}
                      </button>
                    ))}
                    <button
                      onClick={() => setIsCustomModel(true)}
                      disabled={isImprovingPrompts}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                        isCustomModel
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      } ${isImprovingPrompts ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Custom
                    </button>
                  </div>
                  {isCustomModel && (
                    <input
                      type="text"
                      value={customModelInput}
                      onChange={(e) => {
                        setCustomModelInput(e.target.value);
                        setSelectedTextModel(e.target.value);
                      }}
                      placeholder="모델명 직접 입력..."
                      className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none text-xs bg-white"
                      disabled={isImprovingPrompts}
                    />
                  )}
                </div>
              </details>

              <button
                onClick={handleAIImprovePrompts}
                disabled={isImprovingPrompts || selectedIndices.size === 0}
                className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                  isImprovingPrompts || selectedIndices.size === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200'
                }`}
              >
                {isImprovingPrompts ? (
                  <>
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    프롬프트 개선 중...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    선택된 {selectedIndices.size}개 프롬프트 AI 개선
                  </>
                )}
              </button>
            </div>
          </details>
        )}

        {/* Prompts Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {presetPrompts.map((prompt, index) => {
            const isSelected = selectedIndices.has(index);
            const isEditing = editingIndex === index;
            return (
              <div
                key={index}
                className={`p-3 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 bg-white opacity-50 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    onClick={() => togglePromptSelection(index)}
                    className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center cursor-pointer ${
                      isSelected ? 'bg-indigo-500' : 'bg-slate-200 hover:bg-slate-300'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-400 mb-1">#{index + 1}</div>
                    {isEditing ? (
                      <textarea
                        autoFocus
                        value={prompt}
                        onChange={(e) => handlePresetPromptChange(index, e.target.value)}
                        onBlur={() => setEditingIndex(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            setEditingIndex(null);
                          }
                          if (e.key === 'Escape') {
                            setEditingIndex(null);
                          }
                        }}
                        className="w-full text-sm leading-tight text-slate-800 bg-white border border-indigo-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        rows={2}
                      />
                    ) : (
                      <div
                        onClick={() => setEditingIndex(index)}
                        className={`text-sm leading-tight cursor-text hover:bg-white hover:rounded p-1 -m-1 ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}
                        title="클릭하여 수정"
                      >
                        {prompt}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between pt-8 border-t border-slate-200">
          <button
            onClick={() => setMode('select')}
            className="px-6 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handlePresetConfirm}
            disabled={selectedIndices.size === 0}
            className={`px-8 py-3 rounded-xl font-bold text-white transition-all transform ${
              selectedIndices.size === 0
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 shadow-lg shadow-indigo-200'
            }`}
          >
            {selectedIndices.size}개 이모티콘 세트 생성
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'custom') {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-3xl font-bold text-slate-800">
            커스텀 시나리오 목록
          </h2>
          <p className="text-slate-500 mt-1">
            이모티콘 개수를 선택하고, AI로 자동 생성하거나 직접 입력하세요.
          </p>
        </div>

        {/* Emoticon Count Selector */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-800">이모티콘 개수</h3>
              <p className="text-sm text-slate-500">1개부터 24개까지 선택 가능</p>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="24"
                value={emoticonCount}
                onChange={(e) => handleCountChange(Number(e.target.value))}
                className="w-32 sm:w-48 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={emoticonCount}
                  onChange={(e) => {
                    const val = Math.min(24, Math.max(1, Number(e.target.value) || 1));
                    handleCountChange(val);
                  }}
                  className="w-16 px-3 py-2 rounded-lg border border-slate-200 text-center font-bold text-indigo-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                />
                <span className="text-slate-500 font-medium">개</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Auto-Generate Section - Only for Gemini and OpenAI */}
        {apiConfig?.provider && apiConfig.provider !== 'stability' ? (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800">어떤 캐릭터/테마로 만들까요?</h3>
                <p className="text-sm text-slate-500">
                  테마를 입력하면 24개의 감정/동작 프롬프트가 자동 생성됩니다
                </p>
              </div>
            </div>

            {/* Main Input - Large and Focused */}
            <div className="mb-5">
              <textarea
                autoFocus
                value={aiPromptInput}
                onChange={(e) => setAiPromptInput(e.target.value)}
                placeholder="예: 카페에서 일하는 바리스타&#10;귀여운 공룡 캐릭터&#10;요리하는 셰프&#10;게임하는 고양이..."
                className="w-full px-4 py-4 rounded-xl border-2 border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-base bg-white resize-none h-28"
                disabled={isGenerating}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAIGenerate())}
              />
            </div>

            {/* Model Selector - Collapsible */}
            <details className="mb-4">
              <summary className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700 mb-2">
                텍스트 생성 모델 설정 ▾
              </summary>
              <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex flex-wrap gap-2">
                  {textModels[apiConfig.provider as 'gemini' | 'openai']?.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedTextModel(model.id);
                        setIsCustomModel(false);
                      }}
                      disabled={isGenerating}
                      className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                        selectedTextModel === model.id && !isCustomModel
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {model.name}
                    </button>
                  ))}
                  <button
                    onClick={() => setIsCustomModel(true)}
                    disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                      isCustomModel
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Custom
                  </button>
                </div>
                {isCustomModel && (
                  <input
                    type="text"
                    value={customModelInput}
                    onChange={(e) => {
                      setCustomModelInput(e.target.value);
                      setSelectedTextModel(e.target.value);
                    }}
                    placeholder="모델명 직접 입력 (예: gemini-1.5-pro-latest)"
                    className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none text-xs bg-white"
                    disabled={isGenerating}
                    autoFocus
                  />
                )}
              </div>
            </details>

            <button
              onClick={handleAIGenerate}
              disabled={isGenerating || !aiPromptInput.trim()}
              className={`w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                isGenerating || !aiPromptInput.trim()
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-200'
              }`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  프롬프트 생성 중...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {emoticonCount}개 프롬프트 자동 생성
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-slate-100 rounded-2xl p-6 border border-slate-200">
            <p className="text-slate-600 text-center">
              Stability AI는 텍스트 생성을 지원하지 않습니다. 아래에서 직접 프롬프트를 입력해주세요.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {customPrompts.slice(0, emoticonCount).map((prompt, index) => (
            <div key={index} className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                이모티콘 #{index + 1}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => handleCustomChange(index, e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none text-sm resize-none h-20"
                placeholder={`${index + 1}번 이모티콘 설명...`}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-between pt-8 border-t border-slate-200">
          <button
            onClick={() => setMode('select')}
            className="px-6 py-3 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(customPrompts.slice(0, emoticonCount))}
            className="px-8 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:scale-105 shadow-lg shadow-indigo-200 transition-all transform"
          >
            {emoticonCount}개 이모티콘 세트 생성
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-800">
          2. 시나리오 팩 선택
        </h2>
        <p className="text-slate-500">
          {SCENARIOS.length}개의 프리셋 중 선택하거나 커스텀 세트를 만드세요.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SCENARIOS.map((scenario) => (
          <div
            key={scenario.id}
            onClick={() => handlePresetSelect(scenario)}
            className="cursor-pointer rounded-xl p-5 border-2 border-slate-100 bg-white hover:border-indigo-300 hover:shadow-lg transition-all relative overflow-hidden group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="text-3xl transform group-hover:scale-110 transition-transform duration-300">
                {scenario.icon}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-700">
                  {scenario.title}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1">
                  {scenario.description}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {scenario.prompts.slice(0, 3).map((p, i) => (
                <div
                  key={i}
                  className="text-[10px] bg-slate-50 px-2 py-0.5 rounded text-slate-600 truncate border border-slate-100 max-w-[45%]"
                >
                  {p}
                </div>
              ))}
              <div className="text-[10px] text-slate-400 px-2 py-0.5">+21</div>
            </div>
          </div>
        ))}

        {/* Custom Card */}
        <div
          onClick={() => setMode('custom')}
          className="cursor-pointer rounded-xl p-5 border-2 border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 hover:border-indigo-500 transition-all relative overflow-hidden group flex flex-col justify-center items-center text-center"
        >
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
            <svg
              className="w-6 h-6 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              ></path>
            </svg>
          </div>
          <h3 className="text-lg font-bold text-indigo-900">
            커스텀 세트
          </h3>
          <p className="text-xs text-indigo-600/80">
            AI 자동 생성 또는 직접 입력
          </p>
        </div>
      </div>

    </div>
  );
}
