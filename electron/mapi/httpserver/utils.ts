import type { Request, Response, NextFunction } from "express";

// ── Response helper ──────────────────────────────────────────────────────
export const sendJson = (res: Response, statusCode: number, data: any) => {
    res.status(statusCode).json(data);
};

// ── Async route error wrapper ────────────────────────────────────────────
// Express 5 automatically forwards rejected promises to error middleware,
// but this wrapper provides explicit error formatting for consistency.
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        fn(req, res, next).catch((err) => {
            sendJson(res, 500, { code: -1, msg: `Internal error: ${err}` });
        });
    };
};

// ── Long-polling utility ─────────────────────────────────────────────────
interface PollResult<T> {
    done: boolean;
    payload: T;
}

export const pollQuery = async <T>(
    queryFn: () => Promise<PollResult<T> | null>,
    options: { timeoutMs: number; intervalMs: number },
): Promise<{ finished: boolean; result: T | null }> => {
    const deadline = Date.now() + options.timeoutMs;
    while (true) {
        const result = await queryFn();
        if (result?.done) {
            return { finished: true, result: result.payload };
        }
        if (Date.now() >= deadline) break;
        await new Promise((r) => setTimeout(r, options.intervalMs));
    }
    return { finished: false, result: null };
};

// ── Model function constants ─────────────────────────────────────────────
export const functionArgsMap: Record<string, string[]> = {
    soundTts: ["text"],
    soundClone: ["text", "promptAudio", "promptText"],
    videoGen: ["video", "audio"],
    asr: ["audio"],
    textToImage: ["prompt"],
    imageToImage: ["image", "prompt"],
    live: [],
};

export const functionBizMap: Record<string, string> = {
    soundTts: "SoundGenerate",
    soundClone: "SoundGenerate",
    videoGen: "VideoGen",
    asr: "SoundAsr",
    textToImage: "TextToImage",
    imageToImage: "ImageToImage",
};
