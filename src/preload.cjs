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
    log: (type, content) => ipcRenderer.send('log', type, content),

    // Shell operations
    openExternal: (url) => ipcRenderer.invoke('open-external', url)
};

// Node.js APIs exposed via IPC for context isolation
// When contextIsolation is enabled, these will be the only way to access Node APIs
window.nodeAPI = {
    // Process info (available synchronously)
    platform: process.platform,
    versions: process.versions,

    // Path operations via IPC
    join: (...args) => ipcRenderer.invoke('path-join', ...args),
    dirname: (p) => ipcRenderer.invoke('path-dirname', p),
    basename: (p, ext) => ipcRenderer.invoke('path-basename', p, ext),

    // File system operations via IPC (all async)
    readFile: (path, options) => ipcRenderer.invoke('fs-read-file', path, options),
    writeFile: (path, data, options) => ipcRenderer.invoke('fs-write-file', path, data, options),
    readdir: (path) => ipcRenderer.invoke('fs-readdir', path),
    stat: (path) => ipcRenderer.invoke('fs-stat', path),
    lstat: (path) => ipcRenderer.invoke('fs-lstat', path),
    exists: (path) => ipcRenderer.invoke('fs-exists', path),
    realpath: (path) => ipcRenderer.invoke('fs-realpath', path),
    mkdir: (path, options) => ipcRenderer.invoke('fs-mkdir', path, options),
    rename: (oldPath, newPath) => ipcRenderer.invoke('fs-rename', oldPath, newPath),
    unlink: (path) => ipcRenderer.invoke('fs-unlink', path),
    rmdir: (path, options) => ipcRenderer.invoke('fs-rmdir', path, options),

    // JSON file loading
    loadJsonFile: (path) => ipcRenderer.invoke('load-json-file', path),

    // OS info
    osUptime: () => ipcRenderer.invoke('os-uptime'),
    getUsername: () => ipcRenderer.invoke('get-username'),

    // Network operations
    httpsGet: (options) => ipcRenderer.invoke('https-get', options),
    netSocketTest: (port, host, timeout) => ipcRenderer.invoke('net-socket-test', port, host, timeout),

    // Shell operations
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Backwards compatibility - sync versions (still work while nodeIntegration is enabled)
    // These will be removed once all code is migrated to async versions
    readFileSync: (path, options) => require('fs').readFileSync(path, options),
    existsSync: (path) => require('fs').existsSync(path),
    readdirSync: (path) => require('fs').readdirSync(path),
    statSync: (path) => require('fs').statSync(path),
    lstatSync: (path) => require('fs').lstatSync(path),
    writeFileSync: (path, data, options) => require('fs').writeFileSync(path, data, options),
    joinSync: (...args) => require('path').join(...args),
    dirnameSync: (p) => require('path').dirname(p),
    basenameSync: (p, ext) => ext ? require('path').basename(p, ext) : require('path').basename(p),
    realpathSync: (path) => require('fs').realpathSync(path),

    // File system watcher (still requires nodeIntegration)
    watch: (path, callback) => require('fs').watch(path, callback),

    // Path resolve (for filesystem navigation)
    resolveSync: (...args) => require('path').resolve(...args)
};
