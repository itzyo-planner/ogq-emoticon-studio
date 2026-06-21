import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { ensureCodexProxy } from '@/lib/codexProxy';
import { buildPrompt } from '@/lib/buildPrompt';

type Provider = 'gemini' | 'openai' | 'stability' | 'codex';

interface GenerateRequest {
  provider: Provider;
  model: string;
  apiKey: string;
  characterDesc: string;
  scenarioPrompt: string;
  style: string;
  referenceImageBase64: string | null;
  /** Per-slot composition phrase, e.g. bust-up, worm's-eye, chibi full body. */
  composition?: string;
}


async function generateWithGemini(
  apiKey: string,
  model: string,
  prompt: string,
  referenceImageBase64: string | null
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

  if (referenceImageBase64) {
    const cleanBase64 = referenceImageBase64.replace(
      /^data:image\/(png|jpeg|jpg|webp);base64,/,
      ''
    );
    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: 'image/png',
      },
    });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: parts,
    },
    config: {
      responseModalities: ['image', 'text'],
    },
  });

  if (response.candidates && response.candidates.length > 0) {
    const parts = response.candidates[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
  }

  throw new Error('No image data found in Gemini response');
}

async function generateWithOpenAI(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  const openai = new OpenAI({ apiKey });

  const response = await openai.images.generate({
    model: model,
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json',
  });

  if (response.data && response.data[0]?.b64_json) {
    return `data:image/png;base64,${response.data[0].b64_json}`;
  }

  throw new Error('No image data found in OpenAI response');
}

async function generateWithStability(
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  // Map model IDs to Stability AI API endpoints
  const modelEndpoints: Record<string, string> = {
    'stable-image-ultra': 'https://api.stability.ai/v2beta/stable-image/generate/ultra',
    'stable-image-core': 'https://api.stability.ai/v2beta/stable-image/generate/core',
    'sd3.5-large': 'https://api.stability.ai/v2beta/stable-image/generate/sd3',
    'sd3.5-large-turbo': 'https://api.stability.ai/v2beta/stable-image/generate/sd3',
  };

  const endpoint = modelEndpoints[model] || modelEndpoints['stable-image-core'];

  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('output_format', 'png');
  formData.append('aspect_ratio', '1:1');

  // For SD3 models, specify the model variant
  if (model === 'sd3.5-large') {
    formData.append('model', 'sd3.5-large');
  } else if (model === 'sd3.5-large-turbo') {
    formData.append('model', 'sd3.5-large-turbo');
  }

  // Add negative prompt for better sticker results
  formData.append('negative_prompt', 'shadow, drop shadow, cast shadow, floor, ground, 3d, realistic, photorealistic, gradient, blur, gray background');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'image/*',
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stability AI API error: ${response.status} - ${errorText}`);
  }

  // Get the image as arraybuffer and convert to base64
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return `data:image/png;base64,${base64}`;
}

async function generateWithCodex(
  prompt: string,
  referenceImageBase64: string | null
): Promise<string> {
  const baseUrl = await ensureCodexProxy();

  const developerPrompt =
    `You are an image generator. Always use the image_generation tool. Never respond with text only. ` +
    `Follow the user's detailed rendering rules exactly, including any "NO SHADOW" / "FLAT VECTOR" directives. ` +
    `Produce a transparent-friendly flat sticker asset on a pure white background, and honor the negative prompt.`;

  const userContent: Array<
    { type: 'input_image'; image_url: string } | { type: 'input_text'; text: string }
  > = [];

  if (referenceImageBase64) {
    const cleanBase64 = referenceImageBase64.replace(
      /^data:image\/(png|jpeg|jpg|webp);base64,/,
      ''
    );
    userContent.push({
      type: 'input_image',
      image_url: `data:image/png;base64,${cleanBase64}`,
    });
    userContent.push({
      type: 'input_text',
      text: `Re-draw the character from the reference as a flat vector sticker. ${prompt}`,
    });
  } else {
    userContent.push({
      type: 'input_text',
      text: `Generate an image: ${prompt}`,
    });
  }

  const body = {
    // `gpt-5.4` is the model id exposed by the local `npx openai-oauth`
    // Codex proxy for ChatGPT Plus accounts. It is NOT a public OpenAI
    // model name — do not "fix" this to gpt-4.1 / gpt-5 / gpt-5-codex,
    // those are rejected by the proxy with HTTP 400.
    model: 'gpt-5.4',
    input: [
      { role: 'developer', content: developerPrompt },
      { role: 'user', content: userContent },
    ],
    tools: [{ type: 'image_generation', quality: 'medium', size: '1024x1024' }],
    tool_choice: 'required',
    stream: true,
  };

  const res = await fetch(`${baseUrl}/v1/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Codex OAuth proxy ${res.status}: ${text.slice(0, 300) || 'no body'}`
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let imageB64: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let eventData = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) eventData += line.slice(6);
      }
      if (!eventData || eventData === '[DONE]') continue;

      try {
        const data = JSON.parse(eventData);
        if (
          data.type === 'response.output_item.done' &&
          data.item?.type === 'image_generation_call' &&
          data.item.result
        ) {
          imageB64 = data.item.result as string;
        }
        if (data.type === 'error') {
          throw new Error(data.error?.message || JSON.stringify(data));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.startsWith('Unexpected')) throw e;
      }
    }
  }

  if (!imageB64) {
    const retryRes = await fetch(`${baseUrl}/v1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: false }),
    });
    if (retryRes.ok) {
      const json = await retryRes.json();
      for (const item of json.output || []) {
        if (item.type === 'image_generation_call' && item.result) {
          imageB64 = item.result;
          break;
        }
      }
    }
  }

  if (!imageB64) {
    throw new Error('Codex proxy returned no image data');
  }

  return `data:image/png;base64,${imageB64}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const {
      provider,
      model,
      apiKey,
      characterDesc,
      scenarioPrompt,
      style,
      referenceImageBase64,
      composition,
    } = body;

    if (!provider || !model) {
      return NextResponse.json(
        { error: 'Missing API configuration' },
        { status: 400 }
      );
    }

    if (provider !== 'codex' && !apiKey) {
      return NextResponse.json(
        { error: 'Missing API key' },
        { status: 400 }
      );
    }

    if (!characterDesc || !scenarioPrompt || !style) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(
      characterDesc,
      scenarioPrompt,
      style,
      !!referenceImageBase64,
      composition
    );

    let imageData: string;

    switch (provider) {
      case 'gemini':
        imageData = await generateWithGemini(
          apiKey,
          model,
          prompt,
          referenceImageBase64
        );
        break;

      case 'openai':
        imageData = await generateWithOpenAI(apiKey, model, prompt);
        break;

      case 'stability':
        imageData = await generateWithStability(apiKey, model, prompt);
        break;

      case 'codex':
        imageData = await generateWithCodex(prompt, referenceImageBase64);
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      imageData,
    });
  } catch (error) {
    console.error('Image Generation Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate image',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
