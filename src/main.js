const {
    app,
    BrowserWindow,
    ipcMain
} = require('electron');
const path = require('path');
const fs = require('fs');
const DiscordRichPresence = require('./discord-rpc');
const AchievementManager = require('./achievements');

let mainWindow;
let titleBarCSS = '';
let discordRPC = null;
let achievementManager = null;

// Discord Application Client ID
const DISCORD_CLIENT_ID = '1373472140279549963';

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
        width: 1300,
        height: 1000,
        minWidth: 1300,
        minHeight: 800,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: process.platform === 'linux' ?
            path.join(__dirname, '../assets/icon.png') : process.platform === 'darwin' ?
            path.join(__dirname, '../assets/icon.icns') : path.join(__dirname, '../assets/icon.ico')
    });

    // Load HEAT Labs
    mainWindow.loadURL('https://heatlabs.net');

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setZoomLevel(-0.2);
    });

    // Open DevTools in development mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        // Disconnect Discord RPC when window closes
        if (discordRPC) {
            discordRPC.disconnect();
        }

        // Shutdown Achievement Manager when window closes
        if (achievementManager) {
            achievementManager.shutdown();
            achievementManager = null;
        }
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

    // Update Discord RPC and track page visits when page title changes
    mainWindow.webContents.on('page-title-updated', (event, title) => {
        if (discordRPC && discordRPC.isConnected()) {
            discordRPC.updateWithPage(title);
        }

        // Track page visits for achievements
        if (achievementManager) {
            achievementManager.trackPageVisit(title);
        }
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
        // Prevent multiple injections by checking for our marker
        if (window.__titleBarInitialized) {
          return;
        }
        window.__titleBarInitialized = true;

        let titleBar = null;

        // Function to create title bar element
        const createTitleBar = () => {
          const bar = document.createElement('div');
          bar.className = 'electron-title-bar';
          bar.innerHTML = \`
            <img src="https://views.heatlabs.net/api/track/pcwstats-tracker-pixel-desktop-app.png" alt="HEAT Labs Tracking View Counter" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;" class="heatlabs-tracking-pixel" data-page="desktop-app">
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
          return bar;
        };

        // Function to add event listeners
        const attachEventListeners = (bar) => {
          const minimizeBtn = bar.querySelector('.minimize-btn');
          const maximizeBtn = bar.querySelector('.maximize-btn');
          const closeBtn = bar.querySelector('.close-btn');

          if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
              window.electronAPI?.minimize();
            });
          }

          if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => {
              window.electronAPI?.maximize();
            });
          }

          if (closeBtn) {
            closeBtn.addEventListener('click', () => {
              window.electronAPI?.close();
            });
          }
        };

        // Function to ensure title bar is present
        const ensureTitleBar = () => {
          if (!document.body) return;

          const existing = document.querySelector('.electron-title-bar');

          if (!existing) {
            // Create and insert new title bar
            titleBar = createTitleBar();
            document.body.insertBefore(titleBar, document.body.firstChild);
            attachEventListeners(titleBar);
          } else if (document.body.firstChild !== existing) {
            // Move to top if it's not already there
            document.body.insertBefore(existing, document.body.firstChild);
          }
        };

        // Initial insertion
        if (document.body) {
          ensureTitleBar();
        } else {
          document.addEventListener('DOMContentLoaded', ensureTitleBar);
        }

        // Watch for DOM changes and ensure title bar stays in place
        const observer = new MutationObserver(() => {
          ensureTitleBar();
        });

        // Start observing when body is available
        const startObserving = () => {
          if (document.body) {
            observer.observe(document.body, {
              childList: true,
              subtree: false
            });
          }
        };

        if (document.body) {
          startObserving();
        } else {
          document.addEventListener('DOMContentLoaded', startObserving);
        }

        // Store observer globally to prevent garbage collection
        window.__titleBarObserver = observer;
      })();
    `);
    };

    // Inject on page load events
    mainWindow.webContents.on('dom-ready', () => {
        injectTitleBar();
    });

    // Re-inject on navigation
    mainWindow.webContents.on('did-navigate', () => {
        injectTitleBar();
    });

    // Re-inject on in-page navigation
    mainWindow.webContents.on('did-navigate-in-page', () => {
        injectTitleBar();
    });
}

// Initialize Discord Rich Presence
function initializeDiscordRPC() {
    if (DISCORD_CLIENT_ID && DISCORD_CLIENT_ID !== 'CLIENT_ID_HERE') {
        discordRPC = new DiscordRichPresence(DISCORD_CLIENT_ID);
        discordRPC.initialize().then(success => {
            if (success) {
                console.log('Discord Rich Presence initialized successfully');
            }
        });
    } else {
        console.warn('Discord Client ID not configured.');
    }
}

// Initialize Achievement Manager
function initializeAchievementManager() {
    console.log('Initializing Achievement Manager...');
    achievementManager = new AchievementManager();
    achievementManager.initialize().then(success => {
        if (success) {
            console.log('Achievement Manager initialized successfully');

            // Log initial playtime
            const playtime = achievementManager.getFormattedPlayTime();
            console.log(`Initial playtime: ${playtime.formatted}`);

            // Log achievement status
            const achievements = achievementManager.getAllAchievements();
            const unlockedCount = achievements.filter(a => a.unlocked).length;
            console.log(`Achievements: ${unlockedCount}/${achievements.length} unlocked`);
        } else {
            console.warn('Achievement Manager initialization failed (this is normal when not running in Steam)');
        }
    });
}

// App event listeners
app.whenReady().then(() => {
    createWindow();

    // Initialize Discord RPC
    setTimeout(() => {
        initializeDiscordRPC();
    }, 2000);

    // Initialize Achievement Manager
    setTimeout(() => {
        initializeAchievementManager();
    }, 3000);
});

app.on('window-all-closed', () => {
    // Disconnect Discord RPC
    if (discordRPC) {
        discordRPC.disconnect();
    }

    // Shutdown Achievement Manager
    if (achievementManager) {
        achievementManager.shutdown();
        achievementManager = null;
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();

        // Re-initialize Discord RPC and Achievement Manager for new window
        setTimeout(() => {
            initializeDiscordRPC();
            initializeAchievementManager();
        }, 2000);
    }
});

app.on('before-quit', () => {
    // Ensure Discord RPC is disconnected before quitting
    if (discordRPC) {
        discordRPC.disconnect();
    }

    // Ensure Achievement Manager is shutdown before quitting
    if (achievementManager) {
        achievementManager.shutdown();
        achievementManager = null;
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

// Add IPC handlers for achievements
ipcMain.handle('achievements-get-all', () => {
    if (achievementManager) {
        return achievementManager.getAllAchievements();
    }
    return [];
});

ipcMain.handle('achievements-get-playtime', () => {
    if (achievementManager) {
        return achievementManager.getFormattedPlayTime();
    }
    return {
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0,
        formatted: '0h 0m 0s'
    };
});

ipcMain.handle('achievements-reset', () => {
    if (achievementManager) {
        return achievementManager.resetAchievements();
    }
    return false;
});

ipcMain.handle('achievements-is-steam-available', () => {
    if (achievementManager) {
        return achievementManager.isSteamAvailable();
    }
    return false;
});