import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { AppEnv } from "../../env";
import { sendJson, asyncHandler } from "../utils";

const router = Router();

// ── Multer config ─────────────────────────────────────────────────────────

/**
 * 惰性获取上传目录路径。
 *
 * ⚠️ 必须用函数而非模块级常量：AppEnv.dataRoot 在模块加载阶段还未初始化，
 * 在 main/index.ts 的 import 链中本模块会被提前加载，此时 AppEnv.dataRoot
 * 仍为 null，若直接 path.join(...) 会抛出 ERR_INVALID_ARG_TYPE 导致启动崩溃。
 * 使用函数确保只在真正处理上传请求时才访问 AppEnv.dataRoot，此时 dataRoot
 * 已经初始化完毕。
 */
const getUploadDir = (): string =>
    path.join(AppEnv.dataRoot, "temp", "uploads");

const ensureUploadDir = () => {
    const dir = getUploadDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        ensureUploadDir();
        cb(null, getUploadDir());
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || "";
        const name = `${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}${ext}`;
        cb(null, name);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB
    },
});

// ── POST /api/upload ──────────────────────────────────────────────────────
// 支持两种方式二选一：
//   1. multipart/form-data: file 字段上传文件
//   2. JSON body: { fileBase64: "data:mime;base64,xxxx" 或纯base64, name?: "filename" }

router.post(
    "/",
    (req, res, next) => {
        // 判断是否为 multipart 上传（有 boundary 说明是 multipart）
        const ct = req.headers["content-type"] || "";
        if (ct.includes("multipart/form-data")) {
            upload.single("file")(req, res, next);
        } else {
            next();
        }
    },
    asyncHandler(async (req: Request, res: Response) => {
        // ── 方式1: multipart file ──
        if (req.file) {
            const filePath = req.file.path.replace(/\\/g, "/");
            sendJson(res, 200, {
                code: 0,
                data: {
                    path: filePath,
                    name: req.file.originalname,
                    size: req.file.size,
                    mime: req.file.mimetype,
                },
            });
            return;
        }

        // ── 方式2: JSON body (fileBase64) ──
        const { fileBase64, name } = req.body || {};
        if (!fileBase64) {
            sendJson(res, 400, {
                code: -1,
                msg: "Missing file (multipart) or fileBase64 (JSON)",
            });
            return;
        }

        let buffer: Buffer;
        let ext = ".bin";
        let mime = "application/octet-stream";

        if (typeof fileBase64 === "string" && fileBase64.includes(";base64,")) {
            const matches = fileBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mime = matches[1];
                buffer = Buffer.from(matches[2], "base64");
                const mimeExtMap: Record<string, string> = {
                    "image/png": ".png",
                    "image/jpeg": ".jpg",
                    "image/webp": ".webp",
                    "image/gif": ".gif",
                    "audio/wav": ".wav",
                    "audio/mpeg": ".mp3",
                    "audio/mp3": ".mp3",
                    "video/mp4": ".mp4",
                    "video/webm": ".webm",
                    "text/plain": ".txt",
                    "application/json": ".json",
                };
                ext = mimeExtMap[mime] || ".bin";
            } else {
                buffer = Buffer.from(fileBase64, "base64");
            }
        } else {
            buffer = Buffer.from(fileBase64, "base64");
        }

        ensureUploadDir();
        const fileName =
            name ||
            `${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}${ext}`;
        const filePath = path.join(getUploadDir(), fileName);
        await fs.promises.writeFile(filePath, buffer);

        sendJson(res, 200, {
            code: 0,
            data: {
                path: filePath.replace(/\\/g, "/"),
                name: fileName,
                size: buffer.length,
                mime,
            },
        });
    }),
);

export default router;
