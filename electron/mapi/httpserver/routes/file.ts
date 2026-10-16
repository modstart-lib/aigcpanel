import { Router } from "express";
import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { AppEnv } from "../../env";
import { StorageMain } from "../../storage/main";
import { sendJson, asyncHandler } from "../utils";

const router = Router();

const MIME: Record<string, string> = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".srt": "text/plain; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".json": "application/json",
};

/**
 * Allowed roots for result-file download: the effective data root
 * (hub/file, temp/uploads, logs) plus every installed model directory
 * (where launcher-data / model outputs live). `userData` itself is NOT
 * allowed so config.json / cli-auth.json can never be read.
 */
const allowedRoots = async (): Promise<string[]> => {
    const roots: string[] = [];
    if (AppEnv.dataRoot) roots.push(AppEnv.dataRoot);
    try {
        const storageData = await StorageMain.read("server", null);
        for (const record of storageData?.records || []) {
            if (record?.localPath) roots.push(String(record.localPath));
        }
    } catch {
        /* ignore */
    }
    return roots.map((p) => path.resolve(p));
};

const isAllowed = (target: string, roots: string[]): boolean =>
    roots.some((root) => target === root || target.startsWith(root + path.sep));

// ── POST /api/file/download ──────────────────────────────────────────────
// Stream a result file produced by a model. Requires the access token and
// restricts `path` to the data root / installed model directories.
// Body: { path: "/abs/path/to/result.png" }
router.post(
    "/download",
    asyncHandler(async (req: Request, res: Response) => {
        const raw = String((req.body && req.body.path) ?? "");
        if (!raw) {
            sendJson(res, 400, { code: -1, msg: "Missing path" });
            return;
        }
        const target = path.resolve(raw);
        let stat: fs.Stats;
        try {
            stat = fs.statSync(target);
        } catch {
            sendJson(res, 404, { code: -1, msg: "File not found" });
            return;
        }
        if (!stat.isFile() || !isAllowed(target, await allowedRoots())) {
            sendJson(res, 404, { code: -1, msg: "File not found" });
            return;
        }
        const ext = path.extname(target).toLowerCase();
        res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
        res.setHeader("Content-Length", String(stat.size));
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(path.basename(target))}"`,
        );
        fs.createReadStream(target).pipe(res);
    }),
);

export default router;
