'use client';

import { useState, useRef } from 'react';
import { AppStep, GenerationConfig, ApiConfig, SavedEmoticon, ProjectSaveFile } from '@/types';
import { AI_MODELS } from '@/constants';
import StepApiConfig from '@/components/StepApiConfig';
import StepUpload from '@/components/StepUpload';
import StepScenario from '@/components/StepScenario';
import StepGenerate from '@/components/StepGenerate';

export default function Home() {
  const [step, setStep] = useState<AppStep>('api');

  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    provider: 'gemini',
    model: AI_MODELS[0].id,
    apiKey: '',
  });

  const [config, setConfig] = useState<GenerationConfig>({
    characterDescription: '',
    referenceImage: null,
    style: 'Sticker, Flat Vector, 2D',
  });

  const [selectedPrompts, setSelectedPrompts] = useState<string[]>([]);
  const [projectName, setProjectName] = useState('새 프로젝트');
  const [emoticons, setEmoticons] = useState<SavedEmoticon[]>([]);
  const projectFileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProject = () => {
    const save: ProjectSaveFile = {
      version: '1.0.0',
      savedAt: new Date().toISOString(),
      projectName,
      apiConfig: { provider: apiConfig.provider, model: apiConfig.model },
      config,
      prompts: selectedPrompts,
      emoticons,
    };
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const save = JSON.parse(reader.result as string) as ProjectSaveFile;
        if (save.version !== '1.0.0') { alert('지원하지 않는 버전입니다.'); return; }
        setProjectName(save.projectName || '새 프로젝트');
        setApiConfig(prev => ({ ...prev, provider: save.apiConfig.provider, model: save.apiConfig.model }));
        setConfig(save.config);
        setSelectedPrompts(save.prompts || []);
        setEmoticons(save.emoticons || []);
        if (save.prompts?.length > 0) setStep('generate');
        alert('프로젝트를 불러왔습니다.');
      } catch { alert('파일을 불러오지 못했습니다.'); }
      finally { e.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleScenarioSelect = (prompts: string[]) => {
    setSelectedPrompts(prompts);
    setStep('generate');
  };

  const getStepNumber = () => {
    switch (step) {
      case 'api':
        return 1;
      case 'upload':
        return 2;
      case 'scenario':
        return 3;
      case 'generate':
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">E</div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 leading-none">v1.0.0</span>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="text-sm font-bold text-slate-800 bg-transparent border-none outline-none w-32 truncate"
                placeholder="프로젝트명"
              />
            </div>
            <div className="flex gap-1">
              <button onClick={handleSaveProject} className="px-2 py-1 text-[11px] bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 font-medium transition-colors" title="프로젝트 저장 (.json)">저장</button>
              <button onClick={() => projectFileInputRef.current?.click()} className="px-2 py-1 text-[11px] bg-slate-50 text-slate-700 rounded-md hover:bg-slate-100 font-medium transition-colors" title="프로젝트 불러오기">불러오기</button>
              <input ref={projectFileInputRef} type="file" accept=".json" className="hidden" onChange={handleLoadProject} />
            </div>
          </div>
          <div className="hidden sm:flex gap-2 items-center">
            <button
              onClick={() => setStep('api')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 ${
                step === 'api'
                  ? 'bg-indigo-100 text-indigo-700'
                  : getStepNumber() > 1
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              1. API
            </button>
            <div className="text-slate-300">→</div>
            <button
              onClick={() => setStep('upload')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 ${
                step === 'upload'
                  ? 'bg-indigo-100 text-indigo-700'
                  : getStepNumber() > 2
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              2. Character
            </button>
            <div className="text-slate-300">→</div>
            <button
              onClick={() => setStep('scenario')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 ${
                step === 'scenario'
                  ? 'bg-indigo-100 text-indigo-700'
                  : getStepNumber() > 3
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              3. Scenario
            </button>
            <div className="text-slate-300">→</div>
            <button
              onClick={() => selectedPrompts.length > 0 && setStep('generate')}
              disabled={selectedPrompts.length === 0}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                step === 'generate'
                  ? 'bg-indigo-100 text-indigo-700'
                  : selectedPrompts.length > 0
                  ? 'text-slate-400 hover:text-slate-600 hover:scale-105'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
            >
              4. Generate
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
        {step === 'api' && (
          <StepApiConfig
            config={apiConfig}
            onUpdate={setApiConfig}
            onNext={() => setStep('upload')}
          />
        )}

        {step === 'upload' && (
          <StepUpload
            apiConfig={apiConfig}
            config={config}
            onUpdate={setConfig}
            onNext={() => setStep('scenario')}
          />
        )}

        {step === 'scenario' && (
          <StepScenario
            onConfirm={handleScenarioSelect}
            apiConfig={apiConfig}
          />
        )}

        {step === 'generate' && selectedPrompts.length > 0 && (
          <StepGenerate
            apiConfig={apiConfig}
            config={config}
            prompts={selectedPrompts}
            onConfigUpdate={setConfig}
            onPromptsUpdate={setSelectedPrompts}
            onEmoticonsChange={setEmoticons}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-400 text-sm">
        <p>
          Powered by <span className="font-medium text-slate-500">Younglink</span> • AI Emoticon Generation Platform
        </p>
      </footer>
    </div>
  );
}
