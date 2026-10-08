import { app, webContents } from "electron";
import { Log } from "../mapi/log/main";

/**
 * Runtime diagnostics for hard-to-reproduce failures.
 *
 * A renderer that "worked, then turned white" cannot be explained by renderer
 * JS errors alone: if the process crashed, hung or failed to load, no JS runs
 * and nothing is logged. The main process must observe those events instead.
 *
 * Everything here is written to the normal app log file (logs/log_YYYYMMDD.log)
 * via Log, so no new log destination is introduced.
 */

// Keep only the meaningful tail of a URL (index.html / page/xxx.html) and drop
// query strings, so log lines stay short and comparable.
const summarizeUrl = (url: string) => {
    if (!url) return "";
    const clean = url.split("?")[0];
    const parts = clean.split("/");
    return parts.slice(-2).join("/");
};

const describeWebContents = (contents: Electron.WebContents | null) => {
    try {
        if (!contents || contents.isDestroyed()) {
            return { wcId: null };
        }
        return {
            wcId: contents.id,
            url: summarizeUrl(contents.getURL()),
            title: contents.getTitle(),
        };
    } catch (e) {
        return { wcId: null };
    }
};

// Per-process memory snapshot. Useful to spot a slow leak that ends in an
// OOM / white screen after a long session.
const snapshotMetrics = () => {
    try {
        return app.getAppMetrics().map((m) => ({
            pid: m.pid,
            type: m.type,
            memMB: Math.round(m.memory.workingSetSize / 1024),
            peakMB: Math.round(m.memory.peakWorkingSetSize / 1024),
            cpu: m.cpu ? Number(m.cpu.percentCPUUsage.toFixed(1)) : 0,
        }));
    } catch (e) {
        return null;
    }
};

let metricsTimer: ReturnType<typeof setInterval> | null = null;

const startMetricsSampler = () => {
    if (metricsTimer) return;
    // Low frequency: enough to catch a memory trend over a long session,
    // without flooding the 14-day log retention.
    metricsTimer = setInterval(
        () => {
            const metrics = snapshotMetrics();
            if (metrics) {
                Log.info("Diagnostics.metrics", metrics);
            }
        },
        5 * 60 * 1000,
    );
};

const registerWebContents = (contents: Electron.WebContents) => {
    let unresponsiveAt = 0;

    // Page finished loading successfully: a positive marker so a missing one
    // right before a white screen points at a load failure.
    contents.on("did-finish-load", () => {
        Log.info("Diagnostics.did-finish-load", describeWebContents(contents));
    });

    // Page failed to load (missing file, bad bundle, crashed before paint).
    contents.on(
        "did-fail-load",
        (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
            Log.error("Diagnostics.did-fail-load", {
                ...describeWebContents(contents),
                errorCode,
                errorDescription,
                validatedURL: summarizeUrl(validatedURL),
                isMainFrame,
            });
        },
    );

    // Preload script threw: the renderer may then never get window.$mapi.
    contents.on("preload-error", (event, preloadPath, error: any) => {
        Log.error("Diagnostics.preload-error", {
            ...describeWebContents(contents),
            preloadPath,
            message: error && error.message,
            stack: error && error.stack,
        });
    });

    // The "grey/frozen window" signal: UI thread blocked. We record how long
    // it stayed blocked when it recovers.
    contents.on("unresponsive", () => {
        unresponsiveAt = Date.now();
        Log.error("Diagnostics.unresponsive", {
            ...describeWebContents(contents),
            metrics: snapshotMetrics(),
        });
    });
    contents.on("responsive", () => {
        Log.info("Diagnostics.responsive", {
            ...describeWebContents(contents),
            unresponsiveMs: unresponsiveAt ? Date.now() - unresponsiveAt : 0,
        });
        unresponsiveAt = 0;
    });

    // Per-contents crash (covers child windows too, not just the main one).
    contents.on("render-process-gone", (event, details) => {
        Log.error("Diagnostics.webContents.render-process-gone", {
            ...describeWebContents(contents),
            reason: details.reason,
            exitCode: details.exitCode,
        });
    });
};

export const Diagnostics = {
    register() {
        // Renderer process died: 'crashed' / 'oom' / 'killed' / 'abnormal-exit'.
        app.on("render-process-gone", (event, contents, details) => {
            Log.error("Diagnostics.render-process-gone", {
                ...describeWebContents(contents),
                reason: details.reason,
                exitCode: details.exitCode,
                metrics: snapshotMetrics(),
            });
        });

        // GPU / Utility / network process died. A GPU process crash is a
        // common cause of a white Electron window.
        app.on("child-process-gone", (event, details) => {
            Log.error("Diagnostics.child-process-gone", {
                type: details.type,
                reason: details.reason,
                exitCode: details.exitCode,
                serviceName: details.serviceName,
                name: details.name,
            });
        });

        app.on("web-contents-created", (event, contents) => {
            registerWebContents(contents);
        });

        // Cover contents that were created before register() ran.
        try {
            for (const contents of webContents.getAllWebContents()) {
                registerWebContents(contents);
            }
        } catch (e) {}

        startMetricsSampler();
    },
};
