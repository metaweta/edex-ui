import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import fs from 'fs';
import { app, BrowserWindow, dialog, shell, ipcMain, screen, clipboard, globalShortcut } from 'electron';
import signale from 'signale';
import whichPkg from 'which';
const which = whichPkg;
import { shellEnv } from 'shell-env';
import { Terminal } from './classes/terminal.server.class.js';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// For loading JSON files
const require = createRequire(import.meta.url);

let win, tty, extraTtys;

process.on("uncaughtException", e => {
    signale.fatal(e);
    dialog.showErrorBox("eDEX-UI crashed", e.message || "Cannot retrieve error message.");
    if (tty) {
        tty.close();
    }
    if (extraTtys) {
        Object.keys(extraTtys).forEach(key => {
            if (extraTtys[key] !== null) {
                extraTtys[key].close();
            }
        });
    }
    process.exit(1);
});

signale.start(`Starting eDEX-UI v${app.getVersion()}`);
signale.info(`With Node ${process.versions.node} and Electron ${process.versions.electron}`);
signale.info(`Renderer is Chrome ${process.versions.chrome}`);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    signale.fatal("Error: Another instance of eDEX is already running. Cannot proceed.");
    app.exit(1);
}

signale.time("Startup");

ipcMain.on("log", (e, type, content) => {
    signale[type](content);
});

const settingsFile = join(app.getPath("userData"), "settings.json");
const shortcutsFile = join(app.getPath("userData"), "shortcuts.json");
const lastWindowStateFile = join(app.getPath("userData"), "lastWindowState.json");
const themesDir = join(app.getPath("userData"), "themes");
const innerThemesDir = join(__dirname, "assets/themes");
const kblayoutsDir = join(app.getPath("userData"), "keyboards");
const innerKblayoutsDir = join(__dirname, "assets/kb_layouts");
const fontsDir = join(app.getPath("userData"), "fonts");
const innerFontsDir = join(__dirname, "assets/fonts");

// Unset proxy env variables to avoid connection problems on the internal websockets
// See #222
if (process.env.http_proxy) delete process.env.http_proxy;
if (process.env.https_proxy) delete process.env.https_proxy;

// Bypass GPU acceleration blocklist, trading a bit of stability for a great deal of performance, mostly on Linux
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-video-decode");

// Fix userData folder not setup on Windows
try {
    fs.mkdirSync(app.getPath("userData"));
    signale.info(`Created config dir at ${app.getPath("userData")}`);
} catch(e) {
    signale.info(`Base config dir is ${app.getPath("userData")}`);
}

// Create default settings file
if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({
        shell: (process.platform === "win32") ? "powershell.exe" : "bash",
        shellArgs: '',
        cwd: app.getPath("userData"),
        keyboard: "en-US",
        theme: "tron",
        termFontSize: 15,
        audio: true,
        audioVolume: 1.0,
        disableFeedbackAudio: false,
        clockHours: 24,
        pingAddr: "1.1.1.1",
        port: 3000,
        nointro: false,
        nocursor: false,
        forceFullscreen: true,
        allowWindowed: false,
        excludeThreadsFromToplist: true,
        hideDotfiles: false,
        fsListView: false,
        experimentalGlobeFeatures: true,
        experimentalFeatures: false
    }, "", 4));
    signale.info(`Default settings written to ${settingsFile}`);
}

// Create default shortcuts file
if (!fs.existsSync(shortcutsFile)) {
    fs.writeFileSync(shortcutsFile, JSON.stringify([
        { type: "app", trigger: "Ctrl+Shift+C", action: "COPY", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+V", action: "PASTE", enabled: true },
        { type: "app", trigger: "Ctrl+Tab", action: "NEXT_TAB", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+Tab", action: "PREVIOUS_TAB", enabled: true },
        { type: "app", trigger: "Ctrl+X", action: "TAB_X", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+S", action: "SETTINGS", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+K", action: "SHORTCUTS", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+F", action: "FUZZY_SEARCH", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+L", action: "FS_LIST_VIEW", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+H", action: "FS_DOTFILES", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+P", action: "KB_PASSMODE", enabled: true },
        { type: "app", trigger: "Ctrl+Shift+I", action: "DEV_DEBUG", enabled: false },
        { type: "app", trigger: "Ctrl+Shift+F5", action: "DEV_RELOAD", enabled: true },
        { type: "shell", trigger: "Ctrl+Shift+Alt+Space", action: "neofetch", linebreak: true, enabled: false }
    ], "", 4));
    signale.info(`Default keymap written to ${shortcutsFile}`);
}

// Create default window state file
if(!fs.existsSync(lastWindowStateFile)) {
    fs.writeFileSync(lastWindowStateFile, JSON.stringify({
        useFullscreen: true
    }, "", 4));
    signale.info(`Default last window state written to ${lastWindowStateFile}`);
}

// Copy default themes & keyboard layouts & fonts
signale.pending("Mirroring internal assets...");
try {
    fs.mkdirSync(themesDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerThemesDir).forEach(e => {
    fs.writeFileSync(join(themesDir, e), fs.readFileSync(join(innerThemesDir, e), {encoding:"utf-8"}));
});
try {
    fs.mkdirSync(kblayoutsDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerKblayoutsDir).forEach(e => {
    fs.writeFileSync(join(kblayoutsDir, e), fs.readFileSync(join(innerKblayoutsDir, e), {encoding:"utf-8"}));
});
try {
    fs.mkdirSync(fontsDir);
} catch(e) {
    // Folder already exists
}
fs.readdirSync(innerFontsDir).forEach(e => {
    fs.writeFileSync(join(fontsDir, e), fs.readFileSync(join(innerFontsDir, e)));
});

// Version history logging
const versionHistoryPath = join(app.getPath("userData"), "versions_log.json");
let versionHistory = fs.existsSync(versionHistoryPath) ? JSON.parse(fs.readFileSync(versionHistoryPath, 'utf-8')) : {};
let version = app.getVersion();
if (typeof versionHistory[version] === "undefined") {
    versionHistory[version] = {
        firstSeen: Date.now(),
        lastSeen: Date.now()
    };
} else {
    versionHistory[version].lastSeen = Date.now();
}
fs.writeFileSync(versionHistoryPath, JSON.stringify(versionHistory, 0, 2), {encoding:"utf-8"});

function createWindow(settings, lastWindowState) {
    signale.info("Creating window...");

    let display;
    if (!isNaN(settings.monitor)) {
        display = screen.getAllDisplays()[settings.monitor] || screen.getPrimaryDisplay();
    } else {
        display = screen.getPrimaryDisplay();
    }
    let {x, y, width, height} = display.bounds;
    width++; height++;
    win = new BrowserWindow({
        title: "eDEX-UI",
        x,
        y,
        width,
        height,
        show: false,
        resizable: true,
        movable: settings.allowWindowed || false,
        fullscreen: settings.forceFullscreen || false,
        autoHideMenuBar: true,
        frame: settings.allowWindowed || false,
        backgroundColor: '#000000',
        webPreferences: {
            devTools: true,
            contextIsolation: false,
            backgroundThrottling: false,
            webSecurity: true,
            nodeIntegration: true,
            nodeIntegrationInSubFrames: false,
            allowRunningInsecureContent: false,
            preload: join(__dirname, 'preload.cjs'),
            experimentalFeatures: settings.experimentalFeatures || false
        }
    });

    win.loadFile(join(__dirname, 'ui.html'));

    signale.complete("Frontend window created!");
    win.show();
    if (!settings.allowWindowed) {
        win.setResizable(false);
    } else if (!lastWindowState.useFullscreen) {
        win.setFullScreen(false);
    }

    signale.watch("Waiting for frontend connection...");
}

app.on('ready', async () => {
    signale.pending(`Loading settings file...`);
    let settings = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    let lastWindowState = JSON.parse(fs.readFileSync(lastWindowStateFile, 'utf-8'));

    signale.pending(`Resolving shell path...`);
    settings.shell = await which(settings.shell).catch(e => { throw(e) });
    signale.info(`Shell found at ${settings.shell}`);
    signale.success(`Settings loaded!`);

    if (!fs.existsSync(settings.cwd)) throw new Error("Configured cwd path does not exist.");

    // See #366
    let cleanEnv = await shellEnv(settings.shell).catch(e => { throw e; });

    Object.assign(cleanEnv, {
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        TERM_PROGRAM: "eDEX-UI",
        TERM_PROGRAM_VERSION: app.getVersion()
    }, settings.env);

    signale.pending(`Creating new terminal process on port ${settings.port || '3000'}`);
    tty = new Terminal({
        role: "server",
        shell: settings.shell,
        params: settings.shellArgs || '',
        cwd: settings.cwd,
        env: cleanEnv,
        port: settings.port || 3000
    });
    signale.success(`Terminal back-end initialized!`);
    tty.onclosed = (code, signal) => {
        tty.ondisconnected = () => {};
        signale.complete("Terminal exited", code, signal);
        app.quit();
    };
    tty.onopened = () => {
        signale.success("Connected to frontend!");
        signale.timeEnd("Startup");
    };
    tty.onresized = (cols, rows) => {
        signale.info("Resized TTY to ", cols, rows);
    };
    tty.ondisconnected = () => {
        signale.error("Lost connection to frontend");
        signale.watch("Waiting for frontend connection...");
    };

    // Support for multithreaded systeminformation calls
    signale.pending("Starting multithreaded calls controller...");
    await import("./_multithread.js");

    // Initialize GeoIP database in main process (ESM packages work here)
    signale.pending("Initializing GeoIP database...");
    let geoLookup = null;
    try {
        const geolite2 = await import("geolite2-redist");
        const maxmind = await import("maxmind");
        const geoIPCachePath = join(app.getPath("userData"), "geoIPcache");
        await geolite2.downloadDbs(geoIPCachePath);
        geoLookup = await geolite2.open('GeoLite2-City', dbPath => {
            return maxmind.default ? maxmind.default.open(dbPath) : maxmind.open(dbPath);
        });
        signale.success("GeoIP database initialized!");
    } catch (e) {
        signale.error("Failed to initialize GeoIP:", e.message);
    }

    // IPC handler for GeoIP lookups
    ipcMain.handle("geoip-lookup", (event, ip) => {
        if (!geoLookup) return null;
        try {
            return geoLookup.get(ip);
        } catch (e) {
            return null;
        }
    });

    // IPC handlers for replacing @electron/remote
    // App info
    ipcMain.handle("app-get-version", () => app.getVersion());
    ipcMain.handle("app-get-path", (event, name) => app.getPath(name));

    // App actions
    ipcMain.handle("app-focus", () => app.focus());
    ipcMain.handle("app-relaunch", () => {
        app.relaunch();
        app.quit();
    });
    ipcMain.handle("app-quit", () => app.quit());

    // Process info
    ipcMain.handle("process-argv", () => process.argv);

    // Screen info
    ipcMain.handle("screen-get-displays", () => {
        return screen.getAllDisplays().map(d => ({
            id: d.id,
            bounds: d.bounds,
            workArea: d.workArea,
            scaleFactor: d.scaleFactor,
            rotation: d.rotation
        }));
    });

    // Window control (handlers set up after window creation)
    ipcMain.handle("window-toggle-devtools", () => {
        if (win) win.webContents.toggleDevTools();
    });
    ipcMain.handle("window-set-size", (event, width, height) => {
        if (win) win.setSize(width, height);
    });
    ipcMain.handle("window-set-fullscreen", (event, flag) => {
        if (win) win.setFullScreen(flag);
    });
    ipcMain.handle("window-is-fullscreen", () => {
        return win ? win.isFullScreen() : false;
    });

    // Clipboard
    ipcMain.handle("clipboard-read", () => clipboard.readText());

    // Global shortcuts - store registered shortcuts to track them
    const registeredShortcuts = new Map();
    ipcMain.handle("global-shortcut-register", (event, accelerator, id) => {
        try {
            const success = globalShortcut.register(accelerator, () => {
                // Send the shortcut ID back to renderer
                if (win) win.webContents.send("shortcut-triggered", id);
            });
            if (success) {
                registeredShortcuts.set(id, accelerator);
            }
            return success;
        } catch (e) {
            signale.error(`Failed to register shortcut ${accelerator}:`, e.message);
            return false;
        }
    });
    ipcMain.handle("global-shortcut-unregister-all", () => {
        globalShortcut.unregisterAll();
        registeredShortcuts.clear();
    });

    // File system IPC handlers for context isolation
    ipcMain.handle("fs-read-file", (event, filePath, options) => {
        try {
            return fs.readFileSync(filePath, options);
        } catch (e) {
            throw new Error(`Failed to read file: ${e.message}`);
        }
    });

    ipcMain.handle("fs-write-file", (event, filePath, data, options) => {
        try {
            fs.writeFileSync(filePath, data, options);
            return true;
        } catch (e) {
            throw new Error(`Failed to write file: ${e.message}`);
        }
    });

    ipcMain.handle("fs-readdir", (event, dirPath) => {
        try {
            return fs.readdirSync(dirPath);
        } catch (e) {
            throw new Error(`Failed to read directory: ${e.message}`);
        }
    });

    ipcMain.handle("fs-stat", (event, filePath) => {
        try {
            const stats = fs.statSync(filePath);
            return {
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                isSymbolicLink: stats.isSymbolicLink(),
                size: stats.size,
                mtime: stats.mtime.getTime(),
                atime: stats.atime.getTime(),
                ctime: stats.ctime.getTime(),
                mode: stats.mode
            };
        } catch (e) {
            throw new Error(`Failed to stat: ${e.message}`);
        }
    });

    ipcMain.handle("fs-lstat", (event, filePath) => {
        try {
            const stats = fs.lstatSync(filePath);
            return {
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                isSymbolicLink: stats.isSymbolicLink(),
                size: stats.size,
                mtime: stats.mtime.getTime(),
                atime: stats.atime.getTime(),
                ctime: stats.ctime.getTime(),
                mode: stats.mode
            };
        } catch (e) {
            throw new Error(`Failed to lstat: ${e.message}`);
        }
    });

    ipcMain.handle("fs-exists", (event, filePath) => {
        return fs.existsSync(filePath);
    });

    ipcMain.handle("fs-realpath", (event, filePath) => {
        try {
            return fs.realpathSync(filePath);
        } catch (e) {
            throw new Error(`Failed to resolve realpath: ${e.message}`);
        }
    });

    ipcMain.handle("fs-mkdir", (event, dirPath, options) => {
        try {
            fs.mkdirSync(dirPath, options);
            return true;
        } catch (e) {
            throw new Error(`Failed to create directory: ${e.message}`);
        }
    });

    ipcMain.handle("fs-rename", (event, oldPath, newPath) => {
        try {
            fs.renameSync(oldPath, newPath);
            return true;
        } catch (e) {
            throw new Error(`Failed to rename: ${e.message}`);
        }
    });

    ipcMain.handle("fs-unlink", (event, filePath) => {
        try {
            fs.unlinkSync(filePath);
            return true;
        } catch (e) {
            throw new Error(`Failed to delete file: ${e.message}`);
        }
    });

    ipcMain.handle("fs-rmdir", (event, dirPath, options) => {
        try {
            fs.rmdirSync(dirPath, options);
            return true;
        } catch (e) {
            throw new Error(`Failed to remove directory: ${e.message}`);
        }
    });

    // Load JSON file helper
    ipcMain.handle("load-json-file", (event, filePath) => {
        try {
            const content = fs.readFileSync(filePath, { encoding: 'utf-8' });
            return JSON.parse(content);
        } catch (e) {
            throw new Error(`Failed to load JSON file: ${e.message}`);
        }
    });

    // OS info handlers
    ipcMain.handle("os-platform", () => process.platform);
    ipcMain.handle("os-uptime", async () => {
        const os = await import('os');
        return os.default.uptime();
    });
    ipcMain.handle("get-username", async () => {
        try {
            const username = await import('username');
            return await (username.default ? username.default() : username());
        } catch (e) {
            return process.env.USER || process.env.USERNAME || 'user';
        }
    });

    // HTTPS request handler for update checker and external IP
    ipcMain.handle("https-get", (event, options) => {
        return new Promise((resolve, reject) => {
            import('https').then(https => {
                const req = https.default.get(options, res => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: data
                        });
                    });
                });
                req.on('error', e => reject(e));
                req.setTimeout(options.timeout || 10000, () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });
            });
        });
    });

    // Network socket connectivity test
    ipcMain.handle("net-socket-test", (event, port, host, timeout) => {
        return new Promise((resolve) => {
            import('net').then(net => {
                const socket = new net.default.Socket();
                socket.setTimeout(timeout || 1000);
                socket.on('connect', () => {
                    socket.destroy();
                    resolve(true);
                });
                socket.on('timeout', () => {
                    socket.destroy();
                    resolve(false);
                });
                socket.on('error', () => {
                    socket.destroy();
                    resolve(false);
                });
                socket.connect(port, host);
            });
        });
    });

    // Open external URL
    ipcMain.handle("open-external", (event, url) => {
        return shell.openExternal(url);
    });

    // Path operations
    ipcMain.handle("path-join", (event, ...args) => {
        return join(...args);
    });

    ipcMain.handle("path-dirname", (event, p) => {
        return dirname(p);
    });

    ipcMain.handle("path-basename", async (event, p, ext) => {
        const path = await import('path');
        return ext ? path.default.basename(p, ext) : path.default.basename(p);
    });

    createWindow(settings, lastWindowState);

    // Support for more terminals, used for creating tabs (currently limited to 4 extra terms)
    extraTtys = {};
    let basePort = settings.port || 3000;
    basePort = Number(basePort) + 2;

    for (let i = 0; i < 4; i++) {
        extraTtys[basePort+i] = null;
    }

    ipcMain.on("ttyspawn", (e, arg) => {
        let port = null;
        Object.keys(extraTtys).forEach(key => {
            if (extraTtys[key] === null && port === null) {
                extraTtys[key] = {};
                port = key;
            }
        });

        if (port === null) {
            signale.error("TTY spawn denied (Reason: exceeded max TTYs number)");
            e.sender.send("ttyspawn-reply", "ERROR: max number of ttys reached");
        } else {
            signale.pending(`Creating new TTY process on port ${port}`);
            let term = new Terminal({
                role: "server",
                shell: settings.shell,
                params: settings.shellArgs || '',
                cwd: tty.tty._cwd || settings.cwd,
                env: cleanEnv,
                port: port
            });
            signale.success(`New terminal back-end initialized at ${port}`);
            term.onclosed = (code, signal) => {
                term.ondisconnected = () => {};
                term.wss.close();
                signale.complete(`TTY exited at ${port}`, code, signal);
                extraTtys[term.port] = null;
                term = null;
            };
            term.onopened = pid => {
                signale.success(`TTY ${port} connected to frontend (process PID ${pid})`);
            };
            term.onresized = () => {};
            term.ondisconnected = () => {
                term.onclosed = () => {};
                term.close();
                term.wss.close();
                extraTtys[term.port] = null;
                term = null;
            };

            extraTtys[port] = term;
            e.sender.send("ttyspawn-reply", "SUCCESS: "+port);
        }
    });

    // Backend support for theme and keyboard hotswitch
    let themeOverride = null;
    let kbOverride = null;
    ipcMain.on("getThemeOverride", (e, arg) => {
        e.sender.send("getThemeOverride", themeOverride);
    });
    ipcMain.on("getKbOverride", (e, arg) => {
        e.sender.send("getKbOverride", kbOverride);
    });
    ipcMain.on("setThemeOverride", (e, arg) => {
        themeOverride = arg;
    });
    ipcMain.on("setKbOverride", (e, arg) => {
        kbOverride = arg;
    });
});

app.on('web-contents-created', (e, contents) => {
    // Prevent creating more than one window
    contents.on('new-window', (e, url) => {
        e.preventDefault();
        shell.openExternal(url);
    });

    // Prevent loading something else than the UI
    contents.on('will-navigate', (e, url) => {
        if (url !== contents.getURL()) e.preventDefault();
    });
});

app.on('window-all-closed', () => {
    signale.info("All windows closed");
    app.quit();
});

app.on('before-quit', () => {
    if (tty) tty.close();
    if (extraTtys) {
        Object.keys(extraTtys).forEach(key => {
            if (extraTtys[key] !== null) {
                extraTtys[key].close();
            }
        });
    }
    signale.complete("Shutting down...");
});
