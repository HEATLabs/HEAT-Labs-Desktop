const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  // Create the browser window with custom frame
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // Remove default frame for custom title bar
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: process.platform === 'linux'
      ? path.join(__dirname, '../assets/icon.png')
      : process.platform === 'darwin'
        ? path.join(__dirname, '../assets/icon.icns')
        : path.join(__dirname, '../assets/icon.ico')
  });

  // Load your website
  mainWindow.loadURL('https://heatlabs.net');

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle navigation to external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // Inject custom CSS for the title bar
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      .electron-title-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 32px;
        background: #1a1a1a;
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        -webkit-app-region: drag;
        user-select: none;
      }

      .electron-title-bar .title {
        margin-left: 10px;
        font-weight: 500;
      }

      .electron-title-bar .controls {
        display: flex;
        -webkit-app-region: no-drag;
      }

      .electron-title-bar .control-btn {
        width: 30px;
        height: 30px;
        border: none;
        background: transparent;
        color: white;
        font-size: 14px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
      }

      .electron-title-bar .control-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .electron-title-bar .control-btn.close:hover {
        background: #e74c3c;
      }

      body {
        margin-top: 32px !important;
      }

      /* Ensure original header doesn't conflict */
      header, .header, [class*="header"] {
        margin-top: 32px !important;
      }
    `);

    // Inject the title bar HTML
    mainWindow.webContents.executeJavaScript(`
      if (!document.querySelector('.electron-title-bar')) {
        const titleBar = document.createElement('div');
        titleBar.className = 'electron-title-bar';
        titleBar.innerHTML = \`
          <div class="title">HEAT Labs Desktop</div>
          <div class="controls">
            <button class="control-btn minimize" title="Minimize">−</button>
            <button class="control-btn maximize" title="Maximize">□</button>
            <button class="control-btn close" title="Close">×</button>
          </div>
        \`;
        document.body.prepend(titleBar);

        // Add event listeners for title bar buttons
        titleBar.querySelector('.minimize').addEventListener('click', () => {
          window.electronAPI?.minimize();
        });

        titleBar.querySelector('.maximize').addEventListener('click', () => {
          window.electronAPI?.maximize();
        });

        titleBar.querySelector('.close').addEventListener('click', () => {
          window.electronAPI?.close();
        });
      }
    `);
  });
}

// App event listeners
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle IPC messages from renderer
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});