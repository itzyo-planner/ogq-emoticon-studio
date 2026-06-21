const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('node:child_process');
const http = require('node:http');

const DEV_SERVER_URL = process.env.ELECTRON_DEV_URL || 'http://localhost:3004';
let devServer = null;

const waitForServer = (url, timeoutMs = 45000) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const probe = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Dev server did not respond: ${url}`));
          return;
        }
        setTimeout(probe, 750);
      });

      req.setTimeout(1000, () => {
        req.destroy();
      });
    };

    probe();
  });

const startDevServer = () => {
  if (process.env.ELECTRON_SKIP_NEXT_DEV === '1') return;

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  devServer = spawn(npmCmd, ['run', 'dev'], {
    stdio: 'inherit',
    shell: false,
  });

  devServer.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`Next dev server exited with code ${code}`);
    }
  });
};

const createWindow = async () => {
  startDevServer();
  await waitForServer(DEV_SERVER_URL);

  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: '#f8fafc',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await win.loadURL(DEV_SERVER_URL);
  win.webContents.openDevTools({ mode: 'detach' });
};

app.whenReady().then(createWindow).catch((error) => {
  console.error(error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (devServer) {
    devServer.kill();
    devServer = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (devServer) {
    devServer.kill();
    devServer = null;
  }
});
