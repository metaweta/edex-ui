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

## Future Security Improvements

### Enable Full Context Isolation
The current implementation uses `contextIsolation: false` because many parts of the codebase still rely on direct Node.js access in the renderer (via `require()`). To enable full context isolation:

1. Migrate all `require()` calls in renderer to use `window.nodeAPI` from preload
2. Update component classes to use IPC for any remaining Node.js functionality
3. Set `contextIsolation: true` and `nodeIntegration: false` in BrowserWindow config

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
