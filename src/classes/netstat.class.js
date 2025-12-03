class Netstat {
    constructor(parentId) {
        if (!parentId) throw "Missing parameters";

        // Create DOM
        this.parent = document.getElementById(parentId);
        this.parent.innerHTML += `<div id="mod_netstat">
            <div id="mod_netstat_inner">
                <h1>NETWORK STATUS<i id="mod_netstat_iname"></i></h1>
                <div id="mod_netstat_innercontainer">
                    <div>
                        <h1>STATE</h1>
                        <h2>UNKNOWN</h2>
                    </div>
                    <div>
                        <h1>IPv4</h1>
                        <h2>--.--.--.--</h2>
                    </div>
                    <div>
                        <h1>PING</h1>
                        <h2>--ms</h2>
                    </div>
                </div>
            </div>
        </div>`;

        this.offline = false;
        this.lastconn = {finished: true}; // Use fetch instead of https
        this.iface = null;
        this.failedAttempts = {};
        this.runsBeforeGeoIPUpdate = 0;

        // Init updaters
        this.updateInfo();
        this.infoUpdater = setInterval(() => {
            this.updateInfo();
        }, 2000);

        // Init GeoIP integrated backend - uses IPC to main process
        this.geoLookup = {
            get: (ip) => {
                // This is a synchronous wrapper - actual lookup happens via IPC
                // We cache results to avoid repeated IPC calls
                if (!this._geoCache) this._geoCache = {};
                if (this._geoCache[ip] !== undefined) {
                    return this._geoCache[ip];
                }
                // Return null synchronously, async lookup will update cache
                return null;
            }
        };
        // Async lookup function that updates cache
        this.geoLookupAsync = async (ip) => {
            if (!this._geoCache) this._geoCache = {};
            if (this._geoCache[ip] !== undefined) {
                return this._geoCache[ip];
            }
            try {
                const result = await window.electronAPI.geoipLookup(ip);
                this._geoCache[ip] = result;
                return result;
            } catch (e) {
                console.error("GeoIP lookup error:", e);
                return null;
            }
        };
        console.log("GeoIP: Using IPC-based lookup (main process)");
    }
    updateInfo() {
        window.si.networkInterfaces().then(async data => {
            let offline = false;

            let net = data[0];
            let netID = 0;

            if (typeof window.settings.iface === "string") {
                while (net.iface !== window.settings.iface) {
                    netID++;
                    if (data[netID]) {
                        net = data[netID];
                    } else {
                        // No detected interface has the custom iface name, fallback to automatic detection on next loop
                        window.settings.iface = false;
                        return false;
                    }
                }
            } else {
                // Find the first external, IPv4 connected networkInterface that has a MAC address set

                while (net.operstate !== "up" || net.internal === true || net.ip4 === "" || net.mac === "") {
                    netID++;
                    if (data[netID]) {
                        net = data[netID];
                    } else {
                        // No external connection!
                        this.iface = null;
                        document.getElementById("mod_netstat_iname").innerText = "Interface: (offline)";

                        this.offline = true;
                        document.querySelector("#mod_netstat_innercontainer > div:first-child > h2").innerHTML = "OFFLINE";
                        document.querySelector("#mod_netstat_innercontainer > div:nth-child(2) > h2").innerHTML = "--.--.--.--";
                        document.querySelector("#mod_netstat_innercontainer > div:nth-child(3) > h2").innerHTML = "--ms";
                        break;
                    }
                }
            }

            if (net.ip4 !== this.internalIPv4) this.runsBeforeGeoIPUpdate = 0;

            this.iface = net.iface;
            this.internalIPv4 = net.ip4;
            document.getElementById("mod_netstat_iname").innerText = "Interface: "+net.iface;

            if (net.ip4 === "127.0.0.1") {
                offline = true;
            } else {
                if (this.runsBeforeGeoIPUpdate === 0 && this.lastconn.finished) {
                    this.lastconn.finished = false;
                    try {
                        // Use fetch instead of https module
                        const response = await fetch("https://myexternalip.com/json");
                        const data = await response.json();

                        let geoResult = this.geoLookup.get(data.ip);
                        this.ipinfo = {
                            ip: data.ip,
                            geo: geoResult ? geoResult.location : { latitude: 0, longitude: 0 }
                        };

                        let ip = this.ipinfo.ip;
                        document.querySelector("#mod_netstat_innercontainer > div:nth-child(2) > h2").innerHTML = window._escapeHtml(ip);

                        this.runsBeforeGeoIPUpdate = 10;
                    } catch(e) {
                        this.failedAttempts[e] = (this.failedAttempts[e] || 0) + 1;
                        if (this.failedAttempts[e] > 2) {
                            this.lastconn.finished = true;
                            return false;
                        }
                        console.warn(e);
                        window.electronAPI.log("note", "NetStat: Error fetching data from myexternalip.com");
                        window.electronAPI.log("debug", `Error: ${e}`);
                    }
                    this.lastconn.finished = true;
                } else if (this.runsBeforeGeoIPUpdate !== 0) {
                    this.runsBeforeGeoIPUpdate = this.runsBeforeGeoIPUpdate - 1;
                }

                // Use IPC-based ping instead of net.Socket
                let p = await this.ping(window.settings.pingAddr || "1.1.1.1", 80, net.ip4).catch(() => { offline = true });

                this.offline = offline;
                if (offline) {
                    document.querySelector("#mod_netstat_innercontainer > div:first-child > h2").innerHTML = "OFFLINE";
                    document.querySelector("#mod_netstat_innercontainer > div:nth-child(2) > h2").innerHTML = "--.--.--.--";
                    document.querySelector("#mod_netstat_innercontainer > div:nth-child(3) > h2").innerHTML = "--ms";
                } else {
                    document.querySelector("#mod_netstat_innercontainer > div:first-child > h2").innerHTML = "ONLINE";
                    document.querySelector("#mod_netstat_innercontainer > div:nth-child(3) > h2").innerHTML = Math.round(p)+"ms";
                }
            }
        });
    }
    async ping(target, port, local) {
        // Use IPC to main process for socket-based ping
        try {
            const result = await window.nodeAPI.netSocketTest(port, target, 1900);
            return result.time;
        } catch (e) {
            throw e;
        }
    }
}

module.exports = {
    Netstat
};
