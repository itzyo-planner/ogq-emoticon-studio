export type AIProvider = 'gemini' | 'openai' | 'stability' | 'codex';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  costPerImage: number; // USD per image
}

export interface ApiConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  icon: string;
  prompts: string[];
}

export interface Emoticon {
  id: number;
  prompt: string;
  imageUrl: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
}

export interface GenerationConfig {
  characterDescription: string;
  referenceImage: string | null;
  style: string;
}

export type AppStep = 'api' | 'upload' | 'scenario' | 'generate';

// 프로젝트 저장/불러오기용 직렬화 타입
export interface SavedEmoticon {
  id: number;
  prompt: string;
  imageUrl: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
  cost?: number;
}

export interface ProjectSaveFile {
  version: '1.0.0';
  savedAt: string;
  projectName: string;
  apiConfig: Omit<ApiConfig, 'apiKey'>; // API 키 제외
  config: GenerationConfig;
  prompts: string[];
  emoticons: SavedEmoticon[];
}
