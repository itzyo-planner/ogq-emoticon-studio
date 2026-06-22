import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

interface NukkiRequest {
  imageBase64: string;
}

async function runNukkiPython(imageBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const python = spawn('python', ['nukki_one.py'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    python.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    python.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('Python is not installed or not found in PATH'));
      } else {
        reject(new Error(`Failed to start Python process: ${err.message}`));
      }
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`nukki_one.py exited with code ${code}: ${stderr.slice(0, 500)}`));
        return;
      }
      const result = stdout.trim();
      if (!result) {
        reject(new Error('nukki_one.py returned empty output'));
        return;
      }
      resolve(result);
    });

    // Send base64 image data to Python via stdin
    python.stdin.write(imageBase64);
    python.stdin.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: NukkiRequest = await request.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'Missing imageBase64' }, { status: 400 });
    }

    // Strip data URL prefix if present, pass raw base64 to Python
    const cleanBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');

    const resultBase64 = await runNukkiPython(cleanBase64);

    return NextResponse.json({ success: true, imageData: resultBase64 });
  } catch (error) {
    console.error('Nukki Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to process nukki' },
      { status: 500 }
    );
  }
}
