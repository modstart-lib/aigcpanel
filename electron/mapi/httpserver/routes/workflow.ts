import { Router } from "express";
import type { Request, Response } from "express";
import { DBMain } from "../../db/main";
import { Events } from "../../event/main";
import { Log } from "../../log/main";
import { sendJson, asyncHandler, pollQuery } from "../utils";

const router = Router();

// ── GET /api/workflow/list ───────────────────────────────────────────────
router.get(
    "/list",
    asyncHandler(async (_req: Request, res: Response) => {
        const rows = await DBMain.select(
            "SELECT id, name, createdAt, updatedAt FROM workflow ORDER BY createdAt DESC",
            [],
        );
        sendJson(res, 200, { code: 0, data: { list: rows } });
    }),
);

// ── POST /api/workflow/run-named ─────────────────────────────────────────
router.post(
    "/run-named",
    asyncHandler(async (req: Request, res: Response) => {
        const { name } = req.body || {};
        if (!name) {
            sendJson(res, 400, { code: -1, msg: "Missing name" });
            return;
        }
        const wf = await DBMain.first(
            "SELECT * FROM workflow WHERE name = ? ORDER BY createdAt DESC LIMIT 1",
            [name],
        );
        if (!wf) {
            sendJson(res, 404, {
                code: -1,
                msg: `Workflow not found: ${name}`,
            });
            return;
        }
        let workflowData: any;
        try {
            workflowData = JSON.parse(wf.data);
        } catch {
            workflowData = {};
        }
        workflowData.status = "idle";
        const now = Math.floor(Date.now() / 1000);
        const workflowLogId = await DBMain.insert(
            `INSERT INTO workflow_log (createdAt, updatedAt, workflowId, name, data, status, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                now,
                now,
                wf.id,
                name,
                JSON.stringify(workflowData),
                "idle",
                Date.now(),
                0,
            ],
        );
        sendJson(res, 200, {
            code: 0,
            data: {
                workflowLogId: String(workflowLogId),
                workflowId: String(wf.id),
            },
        });
        Events.callPage("main", "httpserver:submitWorkflow", {
            workflowLogId: String(workflowLogId),
        }).catch((err) => {
            Log.error("httpserver.submitWorkflow.error", err);
        });
    }),
);

// ── POST /api/workflow/cleanup-test ──────────────────────────────────────
router.post(
    "/cleanup-test",
    asyncHandler(async (_req: Request, res: Response) => {
        const testWorkflows = await DBMain.select(
            `SELECT id FROM workflow WHERE name LIKE '_test_%' OR name = '新建工作流'`,
            [],
        );
        for (const wf of testWorkflows) {
            await DBMain.execute(
                "DELETE FROM workflow_log WHERE workflowId = ?",
                [wf.id],
            );
            await DBMain.execute("DELETE FROM workflow WHERE id = ?", [wf.id]);
        }
        sendJson(res, 200, {
            code: 0,
            data: { deleted: testWorkflows.length },
        });
    }),
);

// ── POST /api/workflow/run ───────────────────────────────────────────────
router.post(
    "/run",
    asyncHandler(async (req: Request, res: Response) => {
        const { data: workflowData } = req.body || {};
        if (!workflowData || !Array.isArray(workflowData.nodes)) {
            sendJson(res, 400, { code: -1, msg: "Missing workflow data" });
            return;
        }
        const now = Math.floor(Date.now() / 1000);
        const workflowId = await DBMain.insert(
            `INSERT INTO workflow (createdAt, updatedAt, name, data) VALUES (?, ?, ?, ?)`,
            [now, now, "_test_" + now, JSON.stringify(workflowData)],
        );
        workflowData.status = "idle";
        const workflowLogId = await DBMain.insert(
            `INSERT INTO workflow_log (createdAt, updatedAt, workflowId, name, data, status, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                now,
                now,
                workflowId,
                "_test_" + now,
                JSON.stringify(workflowData),
                "idle",
                Date.now(),
                0,
            ],
        );
        sendJson(res, 200, {
            code: 0,
            data: {
                workflowLogId: String(workflowLogId),
                workflowId: String(workflowId),
            },
        });
        Events.callPage("main", "httpserver:submitWorkflow", {
            workflowLogId: String(workflowLogId),
        }).catch((err) => {
            Log.error("httpserver.submitWorkflow.error", err);
        });
    }),
);

// ── POST /api/workflow/query ─────────────────────────────────────────────
router.post(
    "/query",
    asyncHandler(async (req: Request, res: Response) => {
        const { workflowLogId } = req.body || {};
        if (!workflowLogId) {
            sendJson(res, 400, { code: -1, msg: "Missing workflowLogId" });
            return;
        }
        const queryOnce = async () => {
            const record = await DBMain.first(
                "SELECT * FROM workflow_log WHERE id = ?",
                [workflowLogId],
            );
            if (!record) {
                return {
                    done: true,
                    payload: {
                        code: 0,
                        data: { status: "error", statusMsg: "Not found" },
                    },
                };
            }
            if (
                record.status === "success" ||
                record.status === "error" ||
                record.status === "pause"
            ) {
                let logData: any = null;
                try {
                    logData = JSON.parse(record.data);
                } catch {}
                return {
                    done: true,
                    payload: {
                        code: 0,
                        data: {
                            status: record.status,
                            statusMsg: record.statusMsg,
                            logData,
                        },
                    },
                };
            }
            return { done: false, payload: null };
        };
        const { finished, result } = await pollQuery(queryOnce, {
            timeoutMs: 10_000,
            intervalMs: 500,
        });
        if (finished && result) {
            sendJson(res, 200, result);
        } else {
            sendJson(res, 200, { code: 0, data: { status: "pending" } });
        }
    }),
);

export default router;
