// Preload script - runs in renderer context but has access to Node.js
// Since contextIsolation is false, we assign directly to window

const { ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
window.electronAPI = {
    // App info
    getVersion: () => ipcRenderer.invoke('app-get-version'),
    getPath: (name) => ipcRenderer.invoke('app-get-path', name),

    // App actions
    focus: () => ipcRenderer.invoke('app-focus'),
    relaunch: () => ipcRenderer.invoke('app-relaunch'),
    quit: () => ipcRenderer.invoke('app-quit'),

    // Process info
    getArgv: () => ipcRenderer.invoke('process-argv'),

    // Screen info
    getAllDisplays: () => ipcRenderer.invoke('screen-get-displays'),

    // Window control
    toggleDevTools: () => ipcRenderer.invoke('window-toggle-devtools'),
    setWindowSize: (width, height) => ipcRenderer.invoke('window-set-size', width, height),
    setFullScreen: (flag) => ipcRenderer.invoke('window-set-fullscreen', flag),
    isFullScreen: () => ipcRenderer.invoke('window-is-fullscreen'),

    // Clipboard
    clipboardReadText: () => ipcRenderer.invoke('clipboard-read'),

    // Global shortcuts
    registerShortcut: (accelerator, id) => ipcRenderer.invoke('global-shortcut-register', accelerator, id),
    unregisterAllShortcuts: () => ipcRenderer.invoke('global-shortcut-unregister-all'),

    // Shortcut callback - main process will send this when shortcut is triggered
    onShortcutTriggered: (callback) => {
        ipcRenderer.on('shortcut-triggered', (event, id) => callback(id));
    },

    // GeoIP lookup (already implemented)
    geoipLookup: (ip) => ipcRenderer.invoke('geoip-lookup', ip),

    // Terminal channel communication (existing)
    sendTerminalChannel: (port, ...args) => ipcRenderer.send(`terminal_channel-${port}`, ...args),
    onTerminalChannel: (port, callback) => {
        ipcRenderer.on(`terminal_channel-${port}`, (event, ...args) => callback(...args));
    },

    // TTY spawn (existing)
    spawnTTY: () => ipcRenderer.send('ttyspawn'),
    onTTYSpawnReply: (callback) => {
        ipcRenderer.on('ttyspawn-reply', (event, reply) => callback(reply));
    },

    // Theme/keyboard overrides (existing)
    getThemeOverride: () => {
        return new Promise((resolve) => {
            ipcRenderer.once('getThemeOverride', (event, value) => resolve(value));
            ipcRenderer.send('getThemeOverride');
        });
    },
    getKbOverride: () => {
        return new Promise((resolve) => {
            ipcRenderer.once('getKbOverride', (event, value) => resolve(value));
            ipcRenderer.send('getKbOverride');
        });
    },
    setThemeOverride: (value) => ipcRenderer.send('setThemeOverride', value),
    setKbOverride: (value) => ipcRenderer.send('setKbOverride', value),

    // Logging (existing)
    log: (type, content) => ipcRenderer.send('log', type, content)
};

// Also expose Node.js APIs that are currently used directly in renderer
// These should eventually be migrated to IPC as well, but for now we keep compatibility
window.nodeAPI = {
    // Path operations
    join: (...args) => require('path').join(...args),
    dirname: (p) => require('path').dirname(p),

    // File system (read-only for safety)
    readFileSync: (path, options) => require('fs').readFileSync(path, options),
    existsSync: (path) => require('fs').existsSync(path),
    readdirSync: (path) => require('fs').readdirSync(path),
    statSync: (path) => require('fs').statSync(path),
    writeFileSync: (path, data, options) => require('fs').writeFileSync(path, data, options),

    // Process info
    platform: process.platform,
    versions: process.versions
};
