const {
  app,
  BrowserWindow,
  ipcMain
} = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let titleBarCSS = '';

function createWindow() {
  // Load the title bar CSS file
  const cssPath = path.join(__dirname, 'titlebar.css');
  try {
    titleBarCSS = fs.readFileSync(cssPath, 'utf8');
  } catch (error) {
    console.error('Failed to load titlebar.css:', error);
  }

  // Create the browser window with custom frame
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 1000,
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
    icon: process.platform === 'linux' ?
        path.join(__dirname, '../assets/icon.png') :
        process.platform === 'darwin' ?
            path.join(__dirname, '../assets/icon.icns') :
            path.join(__dirname, '../assets/icon.ico')
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
  mainWindow.webContents.setWindowOpenHandler(({
                                                 url
                                               }) => {
    require('electron').shell.openExternal(url);
    return {
      action: 'deny'
    };
  });

  // Inject title bar on initial load and navigation
  const injectTitleBar = () => {
    // Inject CSS from file
    if (titleBarCSS) {
      mainWindow.webContents.insertCSS(titleBarCSS);
    }

    // Inject the title bar HTML
    mainWindow.webContents.executeJavaScript(`
      (function() {
        // Remove any existing title bar
        const existingTitleBar = document.querySelector('.electron-title-bar');
        if (existingTitleBar) {
          existingTitleBar.remove();
        }

        // Create new title bar
        const titleBar = document.createElement('div');
        titleBar.className = 'electron-title-bar';
        titleBar.innerHTML = \`
          <div class="electron-title-bar-left">
            <span class="electron-title-bar-title">HEAT Labs Desktop</span>
          </div>
          <div class="electron-title-bar-controls">
            <button class="electron-title-bar-button minimize-btn" title="Minimize">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="electron-title-bar-button maximize-btn" title="Maximize">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            </button>
            <button class="electron-title-bar-button close-btn" title="Close">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        \`;
        
        // Insert at the very beginning of body
        if (document.body) {
          document.body.insertBefore(titleBar, document.body.firstChild);
        } else {
          document.addEventListener('DOMContentLoaded', () => {
            document.body.insertBefore(titleBar, document.body.firstChild);
          });
        }

        // Add event listeners for title bar buttons
        titleBar.querySelector('.minimize-btn').addEventListener('click', () => {
          window.electronAPI?.minimize();
        });

        titleBar.querySelector('.maximize-btn').addEventListener('click', () => {
          window.electronAPI?.maximize();
        });

        titleBar.querySelector('.close-btn').addEventListener('click', () => {
          window.electronAPI?.close();
        });
      })();
    `);
  };

  // Inject on initial load
  mainWindow.webContents.on('did-finish-load', () => {
    injectTitleBar();
  });

  // Re-inject on navigation (this prevents disappearing)
  mainWindow.webContents.on('did-navigate', () => {
    injectTitleBar();
  });

  // Re-inject on in-page navigation
  mainWindow.webContents.on('did-navigate-in-page', () => {
    injectTitleBar();
  });

  // Re-inject after any DOM changes that might remove it
  mainWindow.webContents.on('dom-ready', () => {
    injectTitleBar();
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