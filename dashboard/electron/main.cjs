// Electron Main Process for Aether Plant SCADA Desktop Application
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;

function checkDevServer(url, callback) {
  const req = http.get(url, (res) => {
    callback(res.statusCode === 200);
  });
  req.on('error', () => {
    callback(false);
  });
  req.setTimeout(1000, () => {
    req.abort();
    callback(false);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#070a13',
    title: 'AETHER-PLANT SCADA | Native Desktop Edition',
    icon: path.join(__dirname, '../public/icon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  const devServerUrl = 'http://localhost:5173';
  const isProductionArg = process.argv.includes('--production');

  if (!isProductionArg) {
    checkDevServer(devServerUrl, (isAvailable) => {
      if (isAvailable) {
        console.log(`[Desktop] Loading live development server at ${devServerUrl}`);
        mainWindow.loadURL(devServerUrl);
      } else {
        console.log('[Desktop] Dev server not active, loading built distribution bundle...');
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Handle external links (e.g. Sepolia Etherscan)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Custom Application Menu
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        { label: 'Reload Plant SCADA', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { type: 'separator' },
        { label: 'Exit Application', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Fullscreen', accelerator: 'F11', click: () => mainWindow.setFullScreen(!mainWindow.isFullScreen()) },
        { label: 'Toggle Developer Tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow.webContents.toggleDevTools() }
      ]
    },
    {
      label: 'Network',
      submenu: [
        { label: 'AWS ap-south-1 (Mumbai): Connected', enabled: false },
        { label: 'Ethereum Sepolia (11155111): Active', enabled: false }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
