import express from "express";
import type { Request, Response } from "express";
import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ipcMain } from "electron";
import { marked } from "marked";
import { Log } from "../log/main";
import ConfigMain from "../config/main";
import { AppEnv } from "../env";
import apiRouter from "./routes/index";
import docHtml from "./doc.html?raw";
import docMd from "./doc.md?raw";
import docMdEn from "./doc.en.md?raw";
import { sendJson } from "./utils";

let servers: http.Server[] = [];
let isRunning = false;
let runningPort = 0;
let runningLanEnabled = false;

const LOOPBACK = "127.0.0.1";

// ── Helpers ──────────────────────────────────────────────────────────────

const isPrivateV4 = (ip: string): boolean => {
    const [a, b] = ip.split(".").map((n) => parseInt(n, 10));
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
};

// Detect the machine's LAN IPv4 address (best-effort, prefer private ranges).
const getLanAddress = (): string => {
    const ifaces = os.networkInterfaces();
    const candidates: string[] = [];
    for (const name of Object.keys(ifaces)) {
        for (const info of ifaces[name] || []) {
            if (info.family === "IPv4" && !info.internal) {
                candidates.push(info.address);
            }
        }
    }
    return candidates.find(isPrivateV4) || candidates[0] || LOOPBACK;
};

const getAvailablePort = (): Promise<number> => {
    return new Promise((resolve, reject) => {
        const s = http.createServer();
        s.listen(0, LOOPBACK, () => {
            const addr = s.address() as { port: number };
            const port = addr.port;
            s.close(() => resolve(port));
        });
        s.on("error", reject);
    });
};

const generateToken = (): string => {
    return (
        crypto.randomUUID().replace(/-/g, "") +
        crypto.randomUUID().replace(/-/g, "")
    );
};

// Single access token used by all API requests (also written for CLI usage).
const ensureToken = async (): Promise<string> => {
    let token = await ConfigMain.get("httpServerToken", "");
    if (!token) {
        token = generateToken();
        await ConfigMain.set("httpServerToken", token);
    }
    return token;
};

// Whether LAN access is enabled. Migrates the legacy public-access config.
const isLanEnabled = async (): Promise<boolean> => {
    const all = await ConfigMain.all();
    if ("httpServerLanEnabled" in all) {
        return !!all["httpServerLanEnabled"];
    }
    const legacyPublic = all["httpServerPublicEnabled"] === true;
    const legacyHost = all["httpServerHost"] === "0.0.0.0";
    const lan = legacyPublic || legacyHost;
    await ConfigMain.set("httpServerLanEnabled", lan);
    return lan;
};

const writeCliAuthFile = (port: number, token: string): void => {
    try {
        const filePath = path.join(AppEnv.userData, "cli-auth.json");
        fs.writeFileSync(filePath, JSON.stringify({ port, token }), "utf-8");
    } catch (e) {
        Log.error("httpserver.writeCliAuthFile.error", e);
    }
};

// ── Express app factory ──────────────────────────────────────────────────

const createApp = (port: number, apiToken: string, lanEnabled: boolean) => {
    const app = express();

    // Body parser
    app.use(express.json());

    // CORS
    app.use((_req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization",
        );
        if (_req.method === "OPTIONS") {
            res.status(200).end();
            return;
        }
        next();
    });

    // Doc page (no auth required)
    app.get("/doc", (_req, res) => {
        // 语言选择：?lang=en 优先，其次 Accept-Language
        let lang = "zh";
        if (typeof _req.query.lang === "string" && _req.query.lang) {
            lang = _req.query.lang;
        } else {
            const accept = _req.headers["accept-language"] || "";
            if (accept.startsWith("en")) {
                lang = "en";
            }
        }
        // 以实际访问的 Host 作为文档中的 Base URL
        const hostHeader = String(_req.headers.host || "");
        const [reqHost, reqPort] = hostHeader.split(":");
        const displayHost =
            reqHost || (lanEnabled ? getLanAddress() : LOOPBACK);
        const displayPort = reqPort || String(port);
        const md = lang === "en" ? docMdEn : docMd;
        const mdRendered = marked(md, { breaks: true, gfm: true }) as string;
        const title =
            lang === "en"
                ? "AIGCPanel API Documentation"
                : "AIGCPanel HTTP 接口文档";
        const html = docHtml
            .replace(/\{\{TITLE\}\}/g, title)
            .replace(/\{\{PORT\}\}/g, displayPort)
            .replace(/\{\{BIND_ADDR\}\}/g, displayHost)
            .replace(/\{\{CONTENT\}\}/g, mdRendered);
        res.status(200)
            .set("Content-Type", "text/html; charset=utf-8")
            .send(html);
    });

    // Auth middleware: every API request must carry the access token.
    // Accept both `Authorization: Bearer <token>` and `Api-Token: <token>`
    // (the latter is used by the local live service to call back into the app).
    app.use((req, res, next) => {
        const auth = req.headers["authorization"] || "";
        let token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) {
            const header =
                req.headers["api-token"] || req.headers["x-api-token"];
            token = Array.isArray(header)
                ? header[0]
                : (header as string) || "";
        }

        if (token && token === apiToken) {
            next();
            return;
        }

        res.status(401).json({ code: -1, msg: "Unauthorized" });
    });

    // API routes
    app.use(apiRouter);

    // 404 fallback
    app.use((_req: Request, res: Response) => {
        sendJson(res, 404, { code: -1, msg: "Not found" });
    });

    return app;
};

// ── Lifecycle ────────────────────────────────────────────────────────────

const listen = (
    app: express.Express,
    port: number,
    host: string,
): Promise<http.Server> => {
    return new Promise((resolve, reject) => {
        const s = http.createServer(app);
        const onError = (err: any) => reject(err);
        s.once("error", onError);
        s.listen(port, host, () => {
            s.removeListener("error", onError);
            s.on("error", (err: any) => {
                Log.error("httpserver.error", { host, err: String(err) });
            });
            resolve(s);
        });
    });
};

const closeAll = (list: http.Server[]): Promise<void> => {
    return new Promise((resolve) => {
        if (list.length === 0) {
            resolve();
            return;
        }
        let pending = list.length;
        list.forEach((s) => {
            s.close(() => {
                pending -= 1;
                if (pending <= 0) resolve();
            });
        });
    });
};

// 127.0.0.1 is always listened on. When LAN access is enabled, an additional
// listener is bound to the machine's LAN IP, so both loopback and the LAN
// address are reachable.
const start = async (port?: number): Promise<void> => {
    await stop();

    const lanEnabled = await isLanEnabled();
    const configPort = await ConfigMain.get("httpServerPort", 0);
    const resolvedPort = port || configPort || (await getAvailablePort());
    const apiToken = await ensureToken();
    const app = createApp(resolvedPort, apiToken, lanEnabled);

    const hosts = [LOOPBACK];
    const lanAddr = getLanAddress();
    if (lanEnabled && lanAddr && lanAddr !== LOOPBACK) {
        hosts.push(lanAddr);
    }

    const created: http.Server[] = [];
    try {
        for (const host of hosts) {
            created.push(await listen(app, resolvedPort, host));
        }
    } catch (e) {
        await closeAll(created);
        Log.error("httpserver.start.error", e);
        throw e;
    }

    servers = created;
    isRunning = true;
    runningPort = resolvedPort;
    runningLanEnabled = lanEnabled;

    await ConfigMain.set("httpServerPort", resolvedPort);
    writeCliAuthFile(resolvedPort, apiToken);
    Log.info("httpserver.start", {
        port: resolvedPort,
        hosts,
        lanEnabled,
    });
};

const stop = async (): Promise<void> => {
    const list = servers;
    servers = [];
    await closeAll(list);
    isRunning = false;
    runningPort = 0;
};

const effectiveAddr = (enabled: boolean, lanAddr: string): string =>
    enabled && lanAddr ? lanAddr : LOOPBACK;

const status = () => {
    const lanAddr = runningLanEnabled ? getLanAddress() : "";
    return {
        running: isRunning,
        port: runningPort,
        localAddr: LOOPBACK,
        lanEnabled: runningLanEnabled,
        lanAddr,
        // Effective listen address: LAN IP when enabled, otherwise loopback
        bindAddr: effectiveAddr(runningLanEnabled, lanAddr),
    };
};

// ── IPC handlers ─────────────────────────────────────────────────────────

ipcMain.handle("httpserver:status", async () => {
    return status();
});

ipcMain.handle("httpserver:start", async () => {
    try {
        await start();
        return { code: 0 };
    } catch (e) {
        return { code: -1, msg: String(e) };
    }
});

ipcMain.handle("httpserver:stop", async () => {
    await stop();
    return { code: 0 };
});

ipcMain.handle("httpserver:restart", async () => {
    try {
        await start();
        return { code: 0 };
    } catch (e) {
        return { code: -1, msg: String(e) };
    }
});

ipcMain.handle("httpserver:getConfig", async () => {
    const lanEnabled = await isLanEnabled();
    const port = await ConfigMain.get("httpServerPort", 0);
    const token = await ensureToken();
    return { lanEnabled, port, token };
});

ipcMain.handle("httpserver:setConfig", async (_, config: any) => {
    if (config.lanEnabled !== undefined)
        await ConfigMain.set("httpServerLanEnabled", !!config.lanEnabled);
    if (config.token !== undefined)
        await ConfigMain.set("httpServerToken", String(config.token || ""));
    // Apply changes by restarting (the service is always running)
    try {
        await start();
    } catch (e) {
        return { code: -1, msg: String(e) };
    }
    return { code: 0 };
});

export const HttpServerMain = {
    start,
    stop,
    status,
};

export default HttpServerMain;
