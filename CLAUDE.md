# eDEX-UI Development Notes

## Project Overview
Fork of GitSquared/edex-ui updated for Apple Silicon (M3 Mac) compatibility with Electron 28.

## Completed Work

### Security Fixes
- **CVE-2023-30856**: Added WebSocket origin validation in `_boot.js` to prevent CSRF attacks

### ESM/CommonJS Compatibility
- Renamed `.js` files to `.cjs` for CommonJS compatibility (package.json has `"type": "module"`):
  - `src/assets/vendor/encom-globe.cjs`
  - `src/assets/misc/file-icons-match.cjs`
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

## Remaining Issues

### Future Security Improvements
- **Migrate from @electron/remote to contextBridge/IPC**: `@electron/remote` is deprecated with security concerns
- **Enable contextIsolation**: Currently disabled; requires IPC migration first

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
