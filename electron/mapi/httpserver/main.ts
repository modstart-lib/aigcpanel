import express from "express";
import type { Request, Response } from "express";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ipcMain } from "electron";
import { Log } from "../log/main";
import ConfigMain from "../config/main";
import { AppEnv } from "../env";
import { authMiddleware } from "./auth";
import apiRouter from "./routes/index";
import docHtml from "./doc.html?raw";
import { sendJson } from "./utils";

let server: http.Server | null = null;
let isRunning = false;
let runningPort = 0;
let runningToken = "";

// ── Helpers ──────────────────────────────────────────────────────────────

const getAvailablePort = (): Promise<number> => {
    return new Promise((resolve, reject) => {
        const s = http.createServer();
        s.listen(0, "127.0.0.1", () => {
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

const writeCliAuthFile = (port: number, token: string): void => {
    try {
        const filePath = path.join(AppEnv.userData, "cli-auth.json");
        fs.writeFileSync(filePath, JSON.stringify({ port, token }), "utf-8");
    } catch (e) {
        Log.error("httpserver.writeCliAuthFile.error", e);
    }
};

// ── Express app factory ──────────────────────────────────────────────────

const createApp = (port: number, token: string) => {
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
        const html = docHtml.replace(/\{\{PORT\}\}/g, String(port));
        res.status(200)
            .set("Content-Type", "text/html; charset=utf-8")
            .send(html);
    });

    // Bearer token auth
    app.use(authMiddleware(token));

    // API routes
    app.use(apiRouter);

    // 404 fallback
    app.use((_req: Request, res: Response) => {
        sendJson(res, 404, { code: -1, msg: "Not found" });
    });

    return app;
};

// ── Lifecycle ────────────────────────────────────────────────────────────

const start = async (port?: number): Promise<void> => {
    if (isRunning) {
        await stop();
    }
    const resolvedPort = port || (await getAvailablePort());
    const token = generateToken();
    return new Promise((resolve, reject) => {
        const app = createApp(resolvedPort, token);
        const s = http.createServer(app);
        s.listen(resolvedPort, "127.0.0.1", async () => {
            server = s;
            isRunning = true;
            runningPort = resolvedPort;
            runningToken = token;
            await ConfigMain.set("httpServerPort", resolvedPort);
            await ConfigMain.set("httpServerToken", token);
            writeCliAuthFile(resolvedPort, token);
            Log.info("httpserver.start", { port: resolvedPort });
            resolve();
        });
        s.on("error", (err: any) => {
            Log.error("httpserver.error", err);
            reject(err);
        });
    });
};

const stop = async (): Promise<void> => {
    return new Promise((resolve) => {
        if (!server) {
            isRunning = false;
            runningPort = 0;
            resolve();
            return;
        }
        server.close(() => {
            server = null;
            isRunning = false;
            runningPort = 0;
            resolve();
        });
    });
};

const status = () => ({
    running: isRunning,
    port: runningPort,
});

// ── IPC handlers ─────────────────────────────────────────────────────────

ipcMain.handle("httpserver:status", async () => {
    return status();
});

ipcMain.handle("httpserver:start", async (_, port?: number) => {
    try {
        await start(port);
        return { code: 0 };
    } catch (e) {
        return { code: -1, msg: String(e) };
    }
});

ipcMain.handle("httpserver:stop", async () => {
    await stop();
    return { code: 0 };
});

export const HttpServerMain = {
    start,
    stop,
    status,
};

export default HttpServerMain;
