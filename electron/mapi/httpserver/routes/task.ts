import { Router } from "express";
import type { Request, Response } from "express";
import { DBMain } from "../../db/main";
import { Events } from "../../event/main";
import { Log } from "../../log/main";
import { sendJson, asyncHandler } from "../utils";

const router = Router();

// ── POST /api/task/submit ────────────────────────────────────────────────
router.post(
    "/submit",
    asyncHandler(async (req: Request, res: Response) => {
        const { biz, modelConfig, param, title } = req.body || {};
        if (!biz) {
            sendJson(res, 400, { code: -1, msg: "Missing biz" });
            return;
        }
        const taskTitle = title || biz + "-task";
        const taskDbId = await DBMain.insert(
            `INSERT INTO data_task (biz, title, status, startTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig, result, type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                biz,
                taskTitle,
                "queue",
                Date.now(),
                "",
                "",
                "",
                JSON.stringify(param || {}),
                JSON.stringify({}),
                JSON.stringify(modelConfig || {}),
                JSON.stringify({}),
                1,
            ],
        );
        const taskId = String(taskDbId);
        sendJson(res, 200, { code: 0, data: { taskId } });
        Events.callPage("main", "httpserver:submitTask", {
            biz,
            taskId,
        }).catch((err) => {
            Log.error("httpserver.submitTask.error", err);
        });
    }),
);

// ── POST /api/task/continue ──────────────────────────────────────────────
router.post(
    "/continue",
    asyncHandler(async (req: Request, res: Response) => {
        const { taskId, stage, data } = req.body || {};
        if (!taskId || !stage) {
            sendJson(res, 400, {
                code: -1,
                msg: "Missing taskId or stage",
            });
            return;
        }
        const record = await DBMain.first(
            "SELECT * FROM data_task WHERE id = ?",
            [taskId],
        );
        if (!record) {
            sendJson(res, 200, {
                code: -1,
                msg: `Task not found: ${taskId}`,
            });
            return;
        }
        if (record.status !== "pause") {
            sendJson(res, 200, {
                code: -1,
                msg: `Task is not paused (current status: ${record.status})`,
            });
            return;
        }
        const stageTransitions: Record<string, Record<string, string>> = {
            VideoZoom: { Config: "Render", RenderConfirm: "End" },
            VideoMark: { Config: "Render", RenderConfirm: "End" },
            VideoSpeedPart: { Config: "Render" },
            VideoKeepPart: { Config: "Render" },
            VideoQuickCut: { Confirm: "Merge" },
        };
        const biz = record.biz;
        const transitions = stageTransitions[biz] || {};
        const nextStep = transitions[stage];
        if (!nextStep) {
            sendJson(res, 200, {
                code: -1,
                msg: `Unknown stage "${stage}" for biz "${biz}"`,
            });
            return;
        }
        let currentJobResult: any = {};
        try {
            currentJobResult = JSON.parse(record.jobResult) || {};
        } catch (_) {}
        const updatedJobResult = {
            ...currentJobResult,
            step: nextStep,
            [stage]: {
                ...((currentJobResult[stage] as any) || {}),
                ...(data || {}),
            },
        };
        await DBMain.execute(
            "UPDATE data_task SET status = ?, jobResult = ?, statusMsg = ? WHERE id = ?",
            ["queue", JSON.stringify(updatedJobResult), "", taskId],
        );
        sendJson(res, 200, { code: 0, data: { taskId } });
        Events.callPage("main", "httpserver:submitTask", {
            biz,
            taskId,
        }).catch((err) => {
            Log.error("httpserver.continueTask.error", err);
        });
    }),
);

export default router;
