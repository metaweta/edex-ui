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

### Context Isolation Migration (Completed - Partial Isolation)
Migrating renderer code from direct Node.js `require()` calls to use `window.nodeAPI` and `window.electronAPI` exposed via preload script.

**Completed Migrations:**
- `_renderer.js` - Uses `window.nodeAPI` for fs/path operations, `window.nodeAPI.loadJsonFile()` for config files, `crypto.randomUUID()` instead of nanoid
- `terminal.class.js` - Uses window globals for xterm/addons/color, `window.electronAPI` for IPC
- `filesystem.class.js` - Uses `window.nodeAPI` for all fs/path operations
- `netstat.class.js` - Uses `window.electronAPI` for network operations, IPC for socket tests
- `locationGlobe.class.js` - Uses window globals for geodata and globe library
- `updateChecker.class.js` - Uses `window.electronAPI` for version checks and external links
- `sysinfo.class.js` - Uses `window.nodeAPI.platform` and `window.nodeAPI.osUptime()`
- `keyboard.class.js` - Uses `window.nodeAPI.readFileSync()` for layout loading
- `audiofx.class.js` - Uses `window.Howl`/`window.Howler` and `window.nodeAPI.joinSync()`
- `modal.class.js` - Uses `crypto.randomUUID()` instead of nanoid
- `mediaPlayer.class.js` - Uses `window.fileIcons` global
- `cpuinfo.class.js` - Uses `window.nodeAPI.platform` instead of `process.platform`
- `conninfo.class.js` - Uses `window.SmoothieChart`, `window.TimeSeries` from bundle

### Browser Library Bundling (Completed)
Added esbuild bundler to bundle browser-compatible libraries for renderer process:

1. **Build System** (`esbuild.config.mjs`):
   - Bundles `xterm`, `xterm-addon-attach`, `xterm-addon-fit`, `xterm-addon-webgl`, `howler`, `smoothie`, `color`
   - Outputs to `src/dist/renderer-libs.bundle.js` (~730kb)
   - Runs automatically via `prestart` npm script

2. **Entry Point** (`src/renderer-libs.js`):
   - Imports browser-compatible libraries and exposes as window globals
   - `window.XTerm`, `window.AttachAddon`, `window.FitAddon`, `window.WebglAddon`
   - `window.Howl`, `window.Howler`
   - `window.SmoothieChart`, `window.TimeSeries`
   - `window.colorLib`

3. **Note on xterm-addon-ligatures**:
   - Requires Node.js fs/path access to read font files
   - Cannot be bundled for browser - still requires nodeIntegration
   - Made optional in terminal.class.js (gracefully skipped if unavailable)

4. **Updated Class Files**:
   - `conninfo.class.js` - Uses `window.SmoothieChart`, `window.TimeSeries`
   - `cpuinfo.class.js` - Uses `window.SmoothieChart`, `window.TimeSeries`
   - `audiofx.class.js` - Already uses `window.Howl`, `window.Howler`
   - `terminal.class.js` - Uses window globals from bundle

**Remaining Work for Full Context Isolation:**
Full context isolation (`contextIsolation: true`, `nodeIntegration: false`) requires additional changes:
1. Update preload to use `contextBridge.exposeInMainWorld()` instead of direct window assignment
2. Move `fs.watch` to main process with IPC events (currently used in filesystem.class.js)
3. xterm-addon-ligatures will not work with full isolation (requires fs access for font detection)
4. Synchronous functions in preload need to remain for backwards compatibility

**Current Security Status:**
- WebSocket origin validation prevents CSRF attacks (CVE-2023-30856 fixed)
- @electron/remote module removed (attack surface reduced)
- All renderer code uses IPC-based APIs via preload script
- App does not load untrusted web content, so partial isolation is acceptable

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