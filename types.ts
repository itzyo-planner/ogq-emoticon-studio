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
