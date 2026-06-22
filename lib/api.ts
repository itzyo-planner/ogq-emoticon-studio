import { ApiConfig } from '@/types';

export const generateEmoticonImage = async (
  apiConfig: ApiConfig,
  characterDesc: string,
  scenarioPrompt: string,
  style: string,
  referenceImageBase64: string | null,
  composition?: string,
  options?: { noText?: boolean; noOutline?: boolean }
): Promise<string> => {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: apiConfig.provider,
        model: apiConfig.model,
        apiKey: apiConfig.apiKey,
        characterDesc,
        scenarioPrompt,
        style,
        referenceImageBase64,
        composition,
        noText: options?.noText,
        noOutline: options?.noOutline,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.imageData) {
      throw new Error('No image data found in response');
    }

    return data.imageData;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
