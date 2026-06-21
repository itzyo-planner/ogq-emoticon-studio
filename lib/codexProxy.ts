import { spawn, ChildProcess, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

export const OAUTH_PORT = 10531;
export const OAUTH_URL = `http://127.0.0.1:${OAUTH_PORT}`;

const IS_WINDOWS = process.platform === 'win32';
const NPX_BIN = IS_WINDOWS ? 'npx.cmd' : 'npx';

const AUTH_PATHS = [
  join(os.homedir(), '.codex', 'auth.json'),
  join(os.homedir(), '.chatgpt-local', 'auth.json'),
];

let proxyProcess: ChildProcess | null = null;
let startingPromise: Promise<void> | null = null;

export function hasCodexAuth(): boolean {
  return AUTH_PATHS.some((p) => existsSync(p));
}

async function isProxyAlive(timeoutMs = 800): Promise<boolean> {
  try {
    const res = await fetch(`${OAUTH_URL}/v1/models`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForProxy(timeoutMs = 20000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isProxyAlive(1000)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function killProxyOnPort(): void {
  try {
    if (IS_WINDOWS) {
      const cmd =
        `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${OAUTH_PORT} ^| findstr LISTENING') ` +
        `do @taskkill /F /PID %a >nul 2>&1`;
      execSync(cmd, { stdio: 'ignore', shell: 'cmd.exe' });
    } else {
      execSync(`lsof -ti:${OAUTH_PORT} | xargs kill -9 2>/dev/null`, {
        stdio: 'ignore',
      });
    }
  } catch {
    // ignore
  }
}

async function spawnProxyOnce(): Promise<void> {
  const child = spawn(
    NPX_BIN,
    ['-y', 'openai-oauth', '--port', String(OAUTH_PORT)],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
      detached: false,
      // On Windows, `.cmd` launchers require a shell context.
      shell: IS_WINDOWS,
      windowsHide: true,
    }
  );

  child.stdout?.on('data', (d: Buffer) => {
    const m = d.toString().trim();
    if (m) console.log(`[codex-oauth] ${m}`);
  });
  child.stderr?.on('data', (d: Buffer) => {
    const m = d.toString().trim();
    if (!m) return;
    if (
      m.includes('npm warn') ||
      m.includes('npm notice') ||
      m.includes('ExperimentalWarning') ||
      /^\(node:\d+\)/.test(m)
    ) {
      return;
    }
    console.error(`[codex-oauth] ${m}`);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[codex-oauth] proxy exited with code ${code}`);
    }
    if (proxyProcess === child) proxyProcess = null;
  });

  proxyProcess = child;
}

async function startProxyWithRetries(maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (attempt > 1) {
      killProxyOnPort();
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log(
      `[codex-oauth] starting proxy on ${OAUTH_URL} (attempt ${attempt}/${maxRetries})...`
    );
    await spawnProxyOnce();

    if (await waitForProxy(30000)) {
      console.log('[codex-oauth] proxy is ready');
      return;
    }

    console.error(`[codex-oauth] proxy did not respond on attempt ${attempt}`);
    if (proxyProcess) {
      proxyProcess.kill();
      proxyProcess = null;
    }
  }

  throw new Error(
    'Codex OAuth proxy failed to start after 3 attempts. ' +
      'Ensure `npx @openai/codex login` has been run and port 10531 is free.'
  );
}

export async function ensureCodexProxy(): Promise<string> {
  if (!hasCodexAuth()) {
    throw new Error(
      'Codex OAuth 세션을 찾을 수 없습니다. 터미널에서 `npx @openai/codex login`을 먼저 실행해주세요.'
    );
  }

  if (await isProxyAlive(500)) {
    return OAUTH_URL;
  }

  if (startingPromise) {
    await startingPromise;
    return OAUTH_URL;
  }

  startingPromise = startProxyWithRetries().finally(() => {
    startingPromise = null;
  });

  await startingPromise;
  return OAUTH_URL;
}

if (typeof process !== 'undefined' && !(globalThis as any).__codexProxyCleanupRegistered) {
  (globalThis as any).__codexProxyCleanupRegistered = true;

  const cleanup = () => {
    if (proxyProcess) {
      try {
        if (IS_WINDOWS && typeof proxyProcess.pid === 'number') {
          // Windows: kill the whole process tree spawned by `npx.cmd`.
          try {
            execSync(`taskkill /PID ${proxyProcess.pid} /T /F`, { stdio: 'ignore' });
          } catch {
            // fall through
          }
        } else {
          proxyProcess.kill();
        }
      } catch {
        // ignore
      }
      proxyProcess = null;
    }
  };

  try {
    process.once('exit', cleanup);
    process.once('SIGINT', () => {
      cleanup();
      process.exit(130);
    });
    if (!IS_WINDOWS) {
      // Windows does not support SIGTERM/SIGHUP the same way; listener would never fire.
      process.once('SIGTERM', () => {
        cleanup();
        process.exit(143);
      });
    }
  } catch {
    // Signal registration unsupported — ignore.
  }
}
