# eDEX-UI Development Notes

## Project Overview
Fork of GitSquared/edex-ui updated for Apple Silicon (M3 Mac) compatibility with Electron 28.

## Completed Work

### Security Fixes
- **CVE-2023-30856**: Added WebSocket origin validation in `_boot.js` to prevent CSRF attacks
- **@electron/remote Removal**: Completed full migration away from deprecated @electron/remote module

### @electron/remote Migration (Completed)
Removed the deprecated @electron/remote module by implementing a proper IPC-based architecture:

1. **Preload Script** (`src/preload.cjs`):
   - Created preload script exposing safe APIs via `window.electronAPI` and `window.nodeAPI`
   - Uses `.cjs` extension because `package.json` has `"type": "module"`
   - Since `contextIsolation: false`, assigns directly to `window` instead of using `contextBridge`

2. **IPC Handlers** in `_boot.js`:
   - `app-get-version`, `app-get-path`, `app-focus`, `app-relaunch`, `app-quit`
   - `process-argv`, `screen-get-displays`
   - `window-toggle-devtools`, `window-set-size`, `window-set-fullscreen`, `window-is-fullscreen`
   - `clipboard-read`
   - `global-shortcut-register`, `global-shortcut-unregister-all`

3. **Updated Renderer Files**:
   - `_renderer.js` - Async initialization using `window.electronAPI.*`
   - `terminal.class.js` - Async clipboard paste via IPC
   - `updateChecker.class.js` - Async version check

4. **Font Loading Fix** in `_renderer.js`:
   - Fixed `waitForFonts()` to properly handle edge cases where document is ready but fonts still loading
   - Added 5-second timeout fallback to prevent app from hanging

### ESM/CommonJS Compatibility
- Renamed `.js` files to `.cjs` for CommonJS compatibility (package.json has `"type": "module"`):
  - `src/assets/vendor/encom-globe.cjs`
  - `src/assets/misc/file-icons-match.cjs`
  - `src/preload.cjs`
- Converted ESM-only packages to dynamic imports with fallbacks:
  - `pretty-bytes` in `conninfo.class.js`

### GeoIP/Globe Markers Fix
- **Problem**: `geolite2-redist` and `maxmind` are pure ESM packages that cannot be loaded in Electron's renderer process
- **Solution**: Moved GeoIP initialization to main process (`_boot.js`) where ESM dynamic imports work
- Added IPC handler `geoip-lookup` in main process for database lookups
- `netstat.class.js` now uses `ipcRenderer.invoke("geoip-lookup", ip)` for async lookups
- `locationGlobe.class.js` `addTemporaryConnectedMarker()` changed to async function
- Globe markers now work when running `traceroute` or any command that outputs IP addresses

### Terminal Fixes
- Split `terminal.class.js` into client and server versions for proper module separation
- Added `allowProposedApi: true` to xterm options for `xterm-addon-ligatures` compatibility
- Added null checks in `keyboard.class.js` for terminal access before initialization

### Context Isolation Migration (In Progress)
Migrating renderer code from direct Node.js `require()` calls to use `window.nodeAPI` and `window.electronAPI` exposed via preload script.

**Completed Migrations:**
- `_renderer.js` - Uses `window.nodeAPI` for fs/path operations, `window.nodeAPI.loadJsonFile()` for config files, `crypto.randomUUID()` instead of nanoid
- `terminal.class.js` - Uses window globals for xterm/addons/color, `window.electronAPI` for IPC
- `filesystem.class.js` - Uses `window.nodeAPI` for all fs/path operations
- `netstat.class.js` - Uses `window.electronAPI` for network operations, IPC for socket tests
- `locationGlobe.class.js` - Uses window globals for geodata and globe library
- `updateChecker.class.js` - Uses `window.electronAPI` for version checks and external links

**Remaining Work for Full Context Isolation:**
- Bundle browser-compatible libraries (xterm, howler, smoothie, color) - currently still using require()
- Enable `contextIsolation: true` and `nodeIntegration: false` in BrowserWindow config
- Testing with full isolation enabled

## Context Isolation Refactoring Plan

### Goal
Enable `contextIsolation: true` and `nodeIntegration: false` for full security hardening. This requires migrating all `require()` calls in renderer code to use either:
1. `window.nodeAPI` (exposed via preload) for simple operations
2. IPC handlers in main process for complex/sensitive operations
3. Bundled browser-compatible libraries where possible

### Current State
- `contextIsolation: false` - renderer has direct Node.js access
- `nodeIntegration: true` - `require()` works in renderer
- Preload exposes `window.electronAPI` and `window.nodeAPI` but not all code uses them

### Files Requiring Migration

#### Phase 1: Core Renderer (`_renderer.js`)
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 37-39 | `require("path")`, `require("fs")`, `require("electron")` | Use `window.nodeAPI` |
| 63-65 | `require(settingsFile)`, `require(shortcutsFile)`, `require(lastWindowStateFile)` | IPC: `load-json-file` handler |
| 86 | `require(themeFile)` | IPC: `load-json-file` handler |
| 244 | `require("nanoid/non-secure")` | Bundle nanoid or use crypto.randomUUID() |
| 276 | `require("os").platform()` | Use `window.nodeAPI.platform` (already exposed) |
| 387 | `require("username")()` | IPC: `get-username` handler |
| 1196 | `require("os").platform()` | Use `window.nodeAPI.platform` |

#### Phase 2: Terminal (`terminal.class.js`)
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 6 | `require("electron")` | Use `window.electronAPI` |
| 17-27 | xterm + addons, color | Bundle with webpack/esbuild (browser-compatible) |

#### Phase 3: Filesystem (`filesystem.class.js`)
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 5-6 | `require("fs")`, `require("path")` | IPC: `fs-*` handlers for all fs operations |
| 11-12 | `require(fileIconsMatcher)`, `require(icons)` | Bundle as JSON or IPC: `load-json-file` |
| 563 | `require("mime-types")` | Bundle (browser-compatible) or IPC |

#### Phase 4: Network Classes
**netstat.class.js:**
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 33, 125 | `require("https")` | IPC: `https-request` handler in main |
| 45, 148 | `require("electron")` | Use `window.electronAPI` |
| 176 | `require("net").Socket()` | IPC: `net-socket-*` handlers |

**conninfo.class.js:**
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 26-27 | `require("smoothie")` | Bundle (browser-compatible library) |

**updateChecker.class.js:**
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 3-4, 13-14 | `require("https")`, `require("electron")` | IPC: `check-for-updates` handler |
| 66 | inline `require("electron").shell` | Use `window.electronAPI.openExternal()` |

#### Phase 5: UI Components
**keyboard.class.js:**
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 5 | `require("fs").readFileSync(layout)` | IPC: `load-json-file` handler |

**locationGlobe.class.js:**
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 5, 7-8 | `require("path")`, load geodata + globe lib | Bundle assets, inline geodata JSON |

**audiofx.class.js:**
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 3-4 | `require("path")`, `require("howler")` | Bundle howler (browser-compatible) |

**cpuinfo.class.js:**
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 12-13 | `require("smoothie")` | Bundle (browser-compatible library) |

**sysinfo.class.js:**
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 7, 15, 102 | `require("os")` | IPC: `os-info` handler or `window.nodeAPI.platform` |

**modal.class.js:**
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 8, 10 | `require("nanoid")` | Bundle nanoid or use crypto.randomUUID() |

**mediaPlayer.class.js:**
| Line | Current | Migration Strategy |
|------|---------|-------------------|
| 5 | `require(icons)` | Bundle as JSON |

### New IPC Handlers Required

Add to `_boot.js`:
```javascript
// File operations
ipcMain.handle('load-json-file', (event, filePath) => { ... });
ipcMain.handle('fs-readdir', (event, path) => { ... });
ipcMain.handle('fs-stat', (event, path) => { ... });
ipcMain.handle('fs-exists', (event, path) => { ... });
ipcMain.handle('fs-read-file', (event, path, options) => { ... });
ipcMain.handle('fs-write-file', (event, path, data, options) => { ... });

// OS info
ipcMain.handle('get-username', async () => { ... });
ipcMain.handle('os-uptime', () => require('os').uptime());

// Network
ipcMain.handle('https-get', (event, options) => { ... });
ipcMain.handle('net-socket-connect', (event, port, host) => { ... });

// Update checker
ipcMain.handle('check-for-updates', async () => { ... });
ipcMain.handle('open-external', (event, url) => shell.openExternal(url));
```

### Preload Script Updates

Expand `window.nodeAPI` in `preload.cjs`:
```javascript
window.nodeAPI = {
    // Existing
    platform: process.platform,
    versions: process.versions,

    // Add async IPC wrappers
    loadJsonFile: (path) => ipcRenderer.invoke('load-json-file', path),
    fsReaddir: (path) => ipcRenderer.invoke('fs-readdir', path),
    fsStat: (path) => ipcRenderer.invoke('fs-stat', path),
    fsExists: (path) => ipcRenderer.invoke('fs-exists', path),
    fsReadFile: (path, opts) => ipcRenderer.invoke('fs-read-file', path, opts),
    fsWriteFile: (path, data, opts) => ipcRenderer.invoke('fs-write-file', path, data, opts),
    getUsername: () => ipcRenderer.invoke('get-username'),
    osUptime: () => ipcRenderer.invoke('os-uptime'),
    httpsGet: (options) => ipcRenderer.invoke('https-get', options),
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
};
```

### Build System Changes

Consider adding a bundler (esbuild/webpack) to:
1. Bundle browser-compatible npm packages (xterm, smoothie, howler, nanoid, color)
2. Inline JSON assets (icons, geodata)
3. Tree-shake unused code

### Final BrowserWindow Config

```javascript
mainWindow = new BrowserWindow({
    webPreferences: {
        contextIsolation: true,      // Enable isolation
        nodeIntegration: false,      // Disable Node in renderer
        preload: path.join(__dirname, 'preload.cjs'),
        sandbox: false               // Required for preload to work
    }
});
```

### Migration Order

1. **Add IPC handlers** to `_boot.js` without changing renderer code
2. **Update preload.cjs** to expose new APIs
3. **Migrate files one at a time**, testing after each:
   - Start with simpler files (modal, mediaPlayer, sysinfo)
   - Progress to complex files (filesystem, netstat, terminal)
4. **Add bundler** for npm packages used in renderer
5. **Flip the switch**: `contextIsolation: true`, `nodeIntegration: false`
6. **Test thoroughly** - especially filesystem, network, terminal functionality

## Architecture Notes

### Module System
- `src/package.json` has `"type": "module"` making all `.js` files ESM by default
- Use `.cjs` extension for files that must be CommonJS (vendor libs, etc.)
- Use dynamic `import()` for ESM-only npm packages in CommonJS context

### Key Files
- `src/_boot.js` - Main process entry, creates BrowserWindow, terminal server
- `src/_renderer.js` - Renderer process, initializes UI components
- `src/classes/terminal.class.js` - Client-side terminal (xterm.js)
- `src/classes/terminal.server.class.js` - Server-side terminal (node-pty)
- `src/classes/netstat.class.js` - Network status with GeoIP lookup

## Running
```bash
npm run start        # Normal start
npm run start -- --nointro  # Skip intro animation
```