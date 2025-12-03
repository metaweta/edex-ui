import cluster from 'cluster';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import signale from 'signale';
import si from 'systeminformation';

// ipcMain is only available in the main (primary) process running under Electron
// Worker processes run under plain Node.js and don't have access to electron modules
let ipcMain = null;
if (cluster.isPrimary) {
    const electron = await import('electron');
    ipcMain = electron.ipcMain;
}

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (cluster.isPrimary) {
    // Also, leave a core available for the renderer process
    const osCPUs = os.cpus().length - 1;
    // See #904
    const numCPUs = (osCPUs > 7) ? 7 : osCPUs;

    cluster.setupPrimary({
        exec: join(__dirname, "_multithread.js")
    });

    let workers = [];
    cluster.on("fork", worker => {
        workers.push(worker.id);
    });

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    signale.success("Multithreaded controller ready");

    let lastID = 0;

    function dispatch(type, id, arg) {
        let selectedID = lastID+1;
        if (selectedID > numCPUs-1) selectedID = 0;

        cluster.workers[workers[selectedID]].send(JSON.stringify({
            id,
            type,
            arg
        }));

        lastID = selectedID;
    }

    let queue = {};
    ipcMain.on("systeminformation-call", (e, type, id, ...args) => {
        if (!si[type]) {
            signale.warn("Illegal request for systeminformation");
            return;
        }

        if (args.length > 1 || workers.length <= 0) {
            si[type](...args).then(res => {
                if (e.sender) {
                    e.sender.send("systeminformation-reply-"+id, res);
                }
            });
        } else {
            queue[id] = e.sender;
            dispatch(type, id, args[0]);
        }
    });

    cluster.on("message", (worker, msg) => {
        msg = JSON.parse(msg);
        try {
            if (!queue[msg.id].isDestroyed()) {
                queue[msg.id].send("systeminformation-reply-"+msg.id, msg.res);
                delete queue[msg.id];
            }
        } catch(e) {
            // Window has been closed, ignore.
        }
    });
} else if (cluster.isWorker) {
    signale.info("Multithread worker started at "+process.pid);

    process.on("message", async msg => {
        msg = JSON.parse(msg);
        const res = await si[msg.type](msg.arg);
        process.send(JSON.stringify({
            id: msg.id,
            res
        }));
    });
}
