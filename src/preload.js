const {
    contextBridge,
    ipcRenderer
} = require('electron');

// Expose protected methods
contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),

    // APIs
    platform: process.platform,
    versions: process.versions,

    // Achievement API
    achievements: {
        getAll: () => ipcRenderer.invoke('achievements-get-all'),
        getPlaytime: () => ipcRenderer.invoke('achievements-get-playtime'),
        reset: () => ipcRenderer.invoke('achievements-reset'),
        isSteamAvailable: () => ipcRenderer.invoke('achievements-is-steam-available')
    }
});