import { Files } from "../mapi/file/main";
import { Log } from "../mapi/log/main";
import {
    SendType,
    ServerApiType,
    ServerFunctionDataType,
    ServerInfo,
} from "../mapi/server/type";
import { AigcServerUtil } from "./util";
import { t } from "../config/lang";
import { TimeUtil } from "../lib/util";

type LauncherResultType = {
    result: {
        [key: string]: any;
    };
    endTime: number | null;
};

export const EasyServer = function (config: any) {
    const me = this;
    let controller: any = null;
    // 权重按需下载（prepare）：进度进程与并发去重
    let prepareProcess: any = null;
    let preparePromise: Promise<void> | null = null;
    // 用户主动暂停：进程退出回调按「已暂停」处理，而不是失败
    let preparePausedByUser = false;
    let controllerWatching = {
        id: null as string | null,
        launcherResult: null as LauncherResultType | null,
        resolve: null as ((value: any) => void) | null,
        reject: null as ((reason?: any) => void) | null,
        promiseResolved: false,
    };
    // 离线授权未激活时：保持当前任务挂起（不 reject），等客户端写入 auth.json
    // 后再用同样的 config.json 重新拉起启动器，任务无缝继续。
    this.offlineAuthPending = false;
    this.offlineAuthPendingRun = null as {
        configJsonPath: string;
        option: { timeout: number };
    } | null;
    this.serverConfig = config as {
        // 权重按需下载配置（config.json 的 prepare；存在即表示权重不随包分发）
        // 只允许三个字段：entry / entryArgs / size
        prepare?: {
            size?: number;
            entry?: string;
            entryArgs?: string[];
        } | null;
        easyServer: {
            entry: string;
            entryArgs: string[];
            envs: string[];
            content: string;
            functions: {
                [key: string]: {
                    content?: string;
                    param?: any[];
                };
            };
        };
    };
    this.isRunning = false;
    this.ServerApi = null as ServerApiType | null;
    this.ServerInfo = null as ServerInfo | null;
    this.serverRuntime = {
        startTime: 0,
    };
    this.send = function (type: SendType, data: any) {
        this.ServerApi.event.sendChannel(this.ServerInfo.eventChannelName, {
            type,
            data,
        });
    };
    this.init = async function () {};
    this.config = async function () {
        // config.json 的 functions 有两种写法：
        // - 新写法：顶层 functions 直接是 { [func]: { param, result, content } } 映射
        // - 旧写法：顶层 functions 为能力名数组，函数定义放在 easyServer.functions
        // 优先使用顶层对象形式，兼容旧写法的 easyServer.functions。
        const easyServer = this.serverConfig.easyServer || {};
        const topFunctions = this.serverConfig.functions;
        const functions =
            topFunctions &&
            typeof topFunctions === "object" &&
            !Array.isArray(topFunctions)
                ? topFunctions
                : easyServer.functions || {};
        return {
            code: 0,
            msg: "ok",
            data: {
                httpUrl: null,
                content: easyServer.content || "",
                functions,
                // 通用模型定义（config.json 的 general 数组）：
                // 每项 { name, title, description, param, result }，供工具
                // "通用模型"渲染表单与展示结果（result 从 stdout 结果按 name 解析）
                general: this.serverConfig.general || [],
            },
        };
    };
    // ── 权重按需下载（prepare）────────────────────────────────────────
    // config.json 的 prepare 字段声明下载入口与产物：
    //   { entry, entryArgs, size }（清单/标记/进度文件名为固定约定）
    // 未生成 flag 时说明权重尚未就绪：先运行 entry（aigcpanelprepare.py），
    // 其 stdout 输出 `Prepare[<json>]` 进度行，转发给页面展示下载百分比。
    this.prepareConfig = this.serverConfig.prepare || null;
    this.prepareProgress = null as any;
    // prepare 日志与模型运行日志同文件：客户端「查看日志」直接可读
    this.prepareLogFile = function () {
        if (this.ServerInfo.logFile) {
            return this.ServerInfo.logFile;
        }
        const file = `logs/${this.ServerInfo.name}_${this.ServerInfo.version}_${TimeUtil.dateString()}.log`;
        this.ServerInfo.logFile = file;
        return file;
    };
    this.prepareFilePaths = function () {
        const root = (this.ServerInfo && this.ServerInfo.localPath) || "";
        // 清单与标记文件为固定约定（config.json 的 prepare 只声明 entry/entryArgs/size）
        return {
            flag: `${root}/.aigcpanel-prepared`,
            state: `${root}/_prepare/state.json`,
            paused: `${root}/_prepare/paused`,
            manifest: `${root}/prepare-manifest.json`,
        };
    };
    this.isPrepareRequired = function () {
        // 以 config.json 是否存在 prepare 字段为准（无 prepare = 权重随包分发）
        return !!this.prepareConfig;
    };
    this.prepareStatus = async function () {
        if (!this.isPrepareRequired()) {
            return {
                required: false,
                ready: true,
                percent: 100,
                progress: null,
            };
        }
        const filePaths = this.prepareFilePaths();
        const ready = await Files.exists(filePaths.flag, {
            isDataPath: false,
        });
        let state: any = null;
        try {
            if (await Files.exists(filePaths.state, { isDataPath: false })) {
                state = JSON.parse(
                    await Files.read(filePaths.state, { isDataPath: false }),
                );
            }
        } catch (e) {
            state = null;
        }
        const paused = await Files.exists(filePaths.paused, {
            isDataPath: false,
        });
        const progress = state || this.prepareProgress || null;
        return {
            required: true,
            ready,
            paused,
            size: this.prepareConfig.size || 0,
            manifest: "prepare-manifest.json",
            percent: ready ? 100 : (progress && progress.percent) || 0,
            progress,
            error: (progress && progress.error) || null,
            logFile: this.prepareLogFile(),
            running: !!preparePromise,
        };
    };
    this.prepare = async function () {
        if (preparePromise) {
            return preparePromise;
        }
        const task = (async () => {
            const cfg = this.prepareConfig;
            if (!this.isPrepareRequired() || !cfg) {
                return;
            }
            if (await this.prepareStatus().then((s: any) => s.ready)) {
                return;
            }
            // 开始（或继续）下载：清除暂停标记，App 重启后才会自动续传
            await Files.deletes(this.prepareFilePaths().paused, {
                isDataPath: false,
            });
            const root = this.ServerInfo.localPath;
            const entry = cfg.entry || "_aienv/bin/python";
            const entryArgs = cfg.entryArgs || ["-u", "aigcpanelprepare.py"];
            const command = [entry].concat(entryArgs);
            const envMap: Record<string, string> = {
                PATH: this.ServerApi.getPathEnv([root, `${root}/binary`]),
                PYTHONIOENCODING: "utf-8",
                AIGCPANEL_SERVER_PLACEHOLDER_ROOT: root,
                AIGCPANEL_SERVER_ROOT: root,
            };
            Log.info("easyServer.prepare.start", {
                command,
                root,
                size: cfg.size || 0,
            });
            Log.info("easyServer.prepare.channel", {
                channel: this.ServerInfo.eventChannelName,
                root,
            });
            const logFile = this.prepareLogFile();
            const appendLog = (text: string) => {
                if (!text) {
                    return;
                }
                this.ServerApi.file
                    .appendText(logFile, text, {
                        isDataPath: true,
                    })
                    .catch(() => {});
            };
            appendLog(
                [
                    "",
                    "========== prepare start ==========",
                    `time: ${TimeUtil.format(Date.now())}`,
                    `command: ${command.join(" ")}`,
                    `cwd: ${root}`,
                    `expectSize: ${cfg.size || 0} bytes`,
                    "",
                ].join("\n") + "\n",
            );
            this.send("preparing", {
                phase: "start",
                percent: 0,
                totalSize: cfg.size || 0,
            });
            await new Promise<void>((resolve, reject) => {
                let buffer = "";
                let stderrTail = "";
                const onStdout = (data: string) => {
                    appendLog(data);
                    buffer += data;
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";
                    for (const line of lines) {
                        const text = line.trim();
                        if (
                            !text.startsWith("Prepare[") ||
                            !text.endsWith("]")
                        ) {
                            continue;
                        }
                        let info: any = null;
                        try {
                            info = JSON.parse(
                                text.slice("Prepare[".length, -1),
                            );
                        } catch (e) {
                            continue;
                        }
                        this.prepareProgress = info;
                        // 用户暂停后，进程退出前的残余输出不再上报（避免界面被拨回下载中）
                        if (preparePausedByUser) {
                            continue;
                        }
                        this.send("preparing", info);
                    }
                };
                const onExit = async (ok: boolean, message?: string) => {
                    prepareProcess = null;
                    if (preparePausedByUser) {
                        // 用户主动暂停：保留已完成文件与 .part，按「已暂停」处理
                        preparePausedByUser = false;
                        appendLog("\n========== prepare paused ==========\n");
                        this.send("preparing", {
                            phase: "paused",
                            percent:
                                (this.prepareProgress &&
                                    this.prepareProgress.percent) ||
                                0,
                        });
                        resolve();
                        return;
                    }
                    if (!ok) {
                        appendLog(
                            "\n========== prepare failed ==========\n" +
                                (message || "") +
                                "\n",
                        );
                        this.send("preparing", {
                            phase: "error",
                            error: message || "prepare failed",
                        });
                        reject(new Error(message || "prepare failed"));
                        return;
                    }
                    // 进程退出后以标记文件为准（防止脚本异常退出但 exit code 为 0）
                    const filePaths = this.prepareFilePaths();
                    if (
                        await Files.exists(filePaths.flag, {
                            isDataPath: false,
                        })
                    ) {
                        appendLog("\n========== prepare finished ==========\n");
                        this.send("preparing", {
                            phase: "done",
                            percent: 100,
                        });
                        resolve();
                    } else {
                        appendLog(
                            "\n========== prepare failed: ready flag missing ==========\n",
                        );
                        this.send("preparing", {
                            phase: "error",
                            error: "prepare finished without ready flag",
                        });
                        reject(
                            new Error("prepare finished without ready flag"),
                        );
                    }
                };
                this.ServerApi.app
                    .spawnShell(command, {
                        env: envMap,
                        cwd: root,
                        // 直接 exec（不经 shell）：取消下载时 SIGINT/taskkill 能命中真实进程，
                        // 避免 kill 到外层 shell 后 python 继续跑
                        shell: false,
                        stdout: onStdout,
                        stderr: (data: string) => {
                            stderrTail = (stderrTail + data).slice(-4000);
                            appendLog(data);
                        },
                        success: () => {
                            onExit(true).catch(() => {});
                        },
                        error: (msg: string) => {
                            onExit(false, stderrTail || msg).catch(() => {});
                        },
                    })
                    .then((process: any) => {
                        prepareProcess = process;
                    })
                    .catch((e: any) => {
                        onExit(false, String(e)).catch(() => {});
                    });
            });
            Log.info("easyServer.prepare.done", { root });
        })();
        preparePromise = task;
        try {
            await preparePromise;
        } finally {
            preparePromise = null;
        }
    };
    // 暂停下载：终止进程、保留已完成文件与 .part，并写入暂停标记
    // （App 重启/自动准备不会自动续传，需用户点击「继续下载」）
    this.pausePrepare = async function () {
        if (!this.isPrepareRequired()) {
            return false;
        }
        // 已就绪时无需暂停（避免误写暂停标记）
        const status: any = await this.prepareStatus();
        if (status.ready) {
            return false;
        }
        const percent =
            (this.prepareProgress && this.prepareProgress.percent) || 0;
        const sleep = (ms: number) =>
            new Promise((resolve) => setTimeout(resolve, ms));
        // 进程句柄可能还没就绪（prepare 刚启动），最多等 1 秒
        for (let i = 0; i < 20 && !prepareProcess && preparePromise; i++) {
            await sleep(50);
        }
        let wasRunning = !!prepareProcess;
        if (prepareProcess) {
            preparePausedByUser = true;
            try {
                prepareProcess.stop();
            } catch (e) {
                Log.error("easyServer.prepare.pause.error", e);
            }
            // 等待进程退出（最多 0.8 秒）；仍在运行说明 SIGINT 被忽略，强制结束
            for (let i = 0; i < 16 && prepareProcess; i++) {
                await sleep(50);
            }
            if (prepareProcess) {
                try {
                    if (typeof prepareProcess.kill === "function") {
                        prepareProcess.kill();
                    }
                } catch (e) {
                    Log.error("easyServer.prepare.pause.kill.error", e);
                }
                prepareProcess = null;
            }
        }
        const filePaths = this.prepareFilePaths();
        try {
            await this.ServerApi.file.write(
                filePaths.paused,
                JSON.stringify(
                    {
                        pausedAt: TimeUtil.format(Date.now()),
                        percent,
                    },
                    null,
                    2,
                ),
                { isDataPath: false },
            );
        } catch (e) {
            Log.error("easyServer.prepare.pause.marker.error", e);
        }
        // 保留 prepareProgress：进程退出回调按「已暂停」上报时仍能带上最后的百分比
        this.ServerApi.file
            .appendText(
                this.prepareLogFile(),
                `\n========== prepare pause requested (${percent}%) ==========\n`,
                { isDataPath: true },
            )
            .catch(() => {});
        Log.info("easyServer.prepare.paused", {
            root: this.ServerInfo.localPath,
            percent,
            wasRunning,
        });
        this.send("preparing", {
            phase: "paused",
            percent,
        });
        return wasRunning;
    };
    this.ensurePrepared = async function () {
        if (!this.isPrepareRequired()) {
            return;
        }
        const status = await this.prepareStatus();
        if (status.ready) {
            return;
        }
        await this.prepare();
    };
    // 调用模型前的前置校验：未就绪直接抛错（不阻塞等待下载）
    this.ensurePreparedOrThrow = async function () {
        if (!this.isPrepareRequired()) {
            return;
        }
        const status: any = await this.prepareStatus();
        if (status.ready) {
            return;
        }
        const percent = Math.round(status.percent || 0);
        if (status.running) {
            throw new Error(
                `模型权重正在下载（${percent}%），请等待下载完成后再调用`,
            );
        }
        if (status.paused) {
            throw new Error(
                `模型权重下载已暂停（${percent}%），请在模型卡片点击「继续下载」后重试`,
            );
        }
        if (status.error) {
            throw new Error(
                `模型权重下载失败：${status.error}，请在模型卡片点击「重试下载」`,
            );
        }
        throw new Error("模型权重尚未下载，请先在模型卡片点击「下载权重」");
    };
    this.start = async function () {
        // console.log('start', this.ServerInfo)
        this.serverRuntime.startTime = Date.now();
        // 权重未就绪时直接报错（下载由「下载/继续下载」按钮或导入后自动触发）
        await this.ensurePreparedOrThrow();
        this.send("starting", this.ServerInfo);
    };
    this.ping = async function (): Promise<boolean> {
        // 只有存在正在运行的 launcher 进程才算服务在运行，
        // 不能仅凭 startTime（模型启动后进程可能已失败退出）
        return !!controller;
    };
    this.stop = async function () {
        // console.log('stop', this.ServerInfo)
        if (prepareProcess) {
            try {
                prepareProcess.stop();
            } catch (e) {
                Log.error("easyServer.prepare.stop.error", e);
            }
            prepareProcess = null;
        }
        this.send("stopping", this.ServerInfo);
        this.serverRuntime.startTime = 0;
        this.send("stopped", this.ServerInfo);
        this.send("success", this.ServerInfo);
    };
    this.cancel = async function () {
        controller.stop();
    };
    // 写入离线授权码（auth.json）并重新拉起被挂起的任务。
    // token 由 Web 后台按「授权名称 + 机器码 + 过期时间」签发，启动器负责验签。
    this.submitOfflineAuth = async function (token: string) {
        if (!this.offlineAuthPending) {
            return { code: -1, msg: "offline auth is not pending" };
        }
        // 先用 launcher 二进制真实校验（签名/包名/设备码/有效期），通过后由 launcher 写入 auth.json
        const saveRet = await this.offlineAuthSave(token);
        if (saveRet.code !== 0) {
            return saveRet;
        }
        this.ServerApi.file.appendText(
            this.ServerInfo.logFile,
            "offline auth saved, restarting launcher",
            { isDataPath: true },
        );
        const pending = this.offlineAuthPendingRun;
        this.offlineAuthPending = false;
        this.offlineAuthPendingRun = null;
        if (pending) {
            me._controllerRunIfNeeded(
                pending.configJsonPath,
                pending.option,
            ).catch((e) => {
                Log.error("easyServer.offlineAuth.restart.error", e);
            });
        }
        return { code: 0, msg: "ok" };
    };
    // 调用 launcher 二进制真实校验并保存授权码（无效/过期/包名或设备码不匹配时返回错误）
    this.offlineAuthSave = async function (token: string) {
        try {
            const env = await this.ServerApi.env();
            env["PATH"] = this.ServerApi.getPathEnv([
                this.ServerInfo.localPath,
                `${this.ServerInfo.localPath}/binary`,
            ]);
            env["AIGCPANEL_SERVER_ROOT"] = this.ServerInfo.localPath;
            const entry = (this.serverConfig.easyServer || {}).entry;
            if (!entry) {
                return { code: -1, msg: "LauncherNotFound" };
            }
            const controller = await this.ServerApi.app.spawnShell(
                [entry, "auth", token],
                {
                    cwd: this.ServerInfo.localPath,
                    env: env,
                    outputEncoding: "utf8",
                },
            );
            let output = "";
            try {
                output = await controller.result();
            } catch (e) {
                output = String(e);
            }
            if (String(output).indexOf("授权码已保存") !== -1) {
                return { code: 0, msg: "ok" };
            }
            const matched = String(output).match(/Error:\s*([^\r\n]+)/);
            const msg = matched
                ? matched[1].trim()
                : (String(output).trim().split("\n").pop() ||
                  "OfflineAuthInvalidToken");
            return { code: -1, msg: msg };
        } catch (e) {
            Log.error("easyServer.offlineAuth.save.error", e);
            return { code: -1, msg: String(e) };
        }
    };
    // 读取本机设备码（供「AI模型」管理里的离线授权弹窗展示/复制）
    this.offlineAuthMachineId = async function () {
        try {
            const env = await this.ServerApi.env();
            env["PATH"] = this.ServerApi.getPathEnv([
                this.ServerInfo.localPath,
                `${this.ServerInfo.localPath}/binary`,
            ]);
            const entry = (this.serverConfig.easyServer || {}).entry;
            if (!entry) {
                return "";
            }
            const controller = await this.ServerApi.app.spawnShell(
                [entry, "uuid"],
                {
                    cwd: this.ServerInfo.localPath,
                    env: env,
                    outputEncoding: "utf8",
                },
            );
            const output = await controller.result();
            const match = String(output || "").match(
                /[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){4}/,
            );
            return match ? match[0] : "";
        } catch (e) {
            Log.error("easyServer.offlineAuth.machineId.error", e);
            return "";
        }
    };
    // 用户取消输入离线授权码：按任务失败处理，避免任务一直挂起。
    this.cancelOfflineAuth = function () {
        if (!this.offlineAuthPending) {
            return { code: 0, msg: "ok" };
        }
        this.offlineAuthPending = false;
        this.offlineAuthPendingRun = null;
        if (controllerWatching.reject && !controllerWatching.promiseResolved) {
            controllerWatching.promiseResolved = true;
            controllerWatching.reject(new Error("已取消离线授权"));
        }
        return { code: 0, msg: "ok" };
    };
    this._controllerRunIfNeeded = async function (
        configJsonPath: string | null,
        option: {
            timeout: number;
        },
    ) {
        if (!controller) {
            let command = [];
            command.push(this.serverConfig.easyServer.entry);
            if (this.serverConfig.easyServer.entryArgs) {
                command = command.concat(
                    this.serverConfig.easyServer.entryArgs,
                );
            }
            for (let i = 0; i < command.length; i++) {
                command[i] = command[i].replace(
                    "${CONFIG}",
                    `"${configJsonPath}"`,
                );
                command[i] = command[i].replace(
                    "${ROOT}",
                    this.ServerInfo.localPath,
                );
            }
            const envMap = {};
            // console.log('EasyServer', this.serverConfig.easyServer)
            if (this.serverConfig.easyServer.entry === "launcher") {
                const systemEnv = await this.ServerApi.env();
                // console.log('EasyServer.systemEnv', systemEnv)
                for (const k in systemEnv) {
                    envMap[k] = systemEnv[k];
                }
            }
            envMap["PATH"] = this.ServerApi.getPathEnv([
                `${this.ServerInfo.localPath}`,
                `${this.ServerInfo.localPath}/binary`,
            ]);
            envMap["PYTHONIOENCODING"] = "utf-8";
            envMap["AIGCPANEL_SERVER_PLACEHOLDER_CONFIG"] = configJsonPath;
            envMap["AIGCPANEL_SERVER_PLACEHOLDER_ROOT"] =
                this.ServerInfo.localPath;
            if (this.serverConfig.easyServer.envs) {
                for (const e of this.serverConfig.easyServer.envs) {
                    let pcs = e.split("=");
                    const key = pcs.shift();
                    envMap[key] = pcs.join("=");
                }
            }
            for (const k in envMap) {
                envMap[k] = envMap[k].replace(
                    "${CONFIG}",
                    `"${configJsonPath}"`,
                );
                envMap[k] = envMap[k].replace(
                    "${ROOT}",
                    this.ServerInfo.localPath,
                );
            }
            // 取出 aigcpanel-queue 中遗留的排队任务并重新拉起执行。
            // 返回是否确实重新拉起了任务：进程退出时若存在排队任务，说明当前等待中
            // 的任务尚未真正执行（见下方 success / error 回调），需要继续等待，
            // 不能以空结果结束当前任务。
            const hasMoreQueue = async (): Promise<boolean> => {
                const queueRoot =
                    this.ServerInfo.localPath + `/aigcpanel-queue/`;
                const files = await Files.list(queueRoot);
                const validQueueFiles = files.filter((f) =>
                    f.name.match(/\.queue\.json$/),
                );
                if (validQueueFiles.length > 0) {
                    const configJson = await Files.temp("json");
                    await Files.copy(validQueueFiles[0].pathname, configJson);
                    await Files.deletes(validQueueFiles[0].pathname);
                    this._controllerRunIfNeeded(configJson, option);
                    return true;
                }
                return false;
            };
            let timer = null;
            if (option.timeout > 0) {
                timer = setTimeout(() => {
                    if (controller) {
                        try {
                            controller.stop();
                        } catch (e) {
                            Log.error("easyServer.timeout.stop.error", e);
                        }
                    }
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        "timeout",
                        { isDataPath: true },
                    );
                    if (controllerWatching.reject) {
                        controllerWatching.reject(undefined);
                    }
                }, option.timeout * 1000);
            }
            let buffer = "";
            controller = await this.ServerApi.app.spawnShell(command, {
                env: envMap,
                cwd: this.ServerInfo.localPath,
                stdout: (_data) => {
                    // console.log('easyServer.stdout', _data)
                    buffer += _data;
                    // check if has \n and process the buffer
                    let lines = buffer.split("\n");
                    buffer = lines.pop() || "";
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        _data,
                        { isDataPath: true },
                    );
                    // 离线授权未激活：启动器会输出 AigcPanelOfflineAuth[...] 标记，
                    // 通知页面弹窗输入授权码，并挂起当前任务等待重试。
                    const offlineAuth =
                        this.ServerApi.extractOfflineAuthRequired(
                            lines.join("\n") + "\n",
                        );
                    if (offlineAuth && !this.offlineAuthPending) {
                        this.offlineAuthPending = true;
                        this.offlineAuthPendingRun = {
                            configJsonPath,
                            option,
                        };
                        this.send("action", {
                            type: "OfflineAuthRequired",
                            ...offlineAuth,
                        });
                    }
                    const result = this.ServerApi.extractResultFromLogs(
                        controllerWatching.id,
                        lines.join("\n") + "\n",
                    );
                    if (result) {
                        if (controllerWatching.launcherResult) {
                            controllerWatching.launcherResult.result =
                                Object.assign(
                                    controllerWatching.launcherResult.result,
                                    result,
                                );
                        }
                        if (controllerWatching.id) {
                            this.send("taskResult", {
                                id: controllerWatching.id,
                                result,
                            });
                        }
                    }
                    if (controllerWatching.launcherResult) {
                        controllerWatching.launcherResult.result.error =
                            AigcServerUtil.errorDetect(_data) ||
                            controllerWatching.launcherResult.result.error;
                        if (
                            controllerWatching.launcherResult.result &&
                            controllerWatching.launcherResult.result["End"]
                        ) {
                            if (
                                controllerWatching.resolve &&
                                !controllerWatching.promiseResolved
                            ) {
                                controllerWatching.promiseResolved = true;
                                controllerWatching.resolve(undefined);
                            }
                        }
                    }
                },
                stderr: (_data) => {
                    // console.log('easyServer.stderr', _data)
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        _data,
                        { isDataPath: true },
                    );
                    if (controllerWatching.launcherResult) {
                        controllerWatching.launcherResult.result.error =
                            AigcServerUtil.errorDetect(_data) ||
                            controllerWatching.launcherResult.result.error;
                    }
                },
                success: (_data) => {
                    // console.log('easyServer.success', _data)
                    clearTimeout(timer);
                    controller = null;
                    // 模型进程退出前若有任务被写入 aigcpanel-queue，说明当前等待中的
                    // 任务尚未真正执行（进程已进入退出窗口），需要重新拉起并继续等待
                    // 其结果；若此处直接以空结果 resolve，会误报「执行失败」，任务还会
                    // 被重新拉起执行，导致界面失败但实际已生成、且任务重复执行。
                    hasMoreQueue()
                        .then((redispatched) => {
                            if (redispatched) {
                                return;
                            }
                            if (
                                controllerWatching.resolve &&
                                !controllerWatching.promiseResolved
                            ) {
                                controllerWatching.promiseResolved = true;
                                controllerWatching.resolve(undefined);
                            }
                        })
                        .catch((e) => {
                            Log.error("easyServer.hasMoreQueue.error", e);
                            if (
                                controllerWatching.resolve &&
                                !controllerWatching.promiseResolved
                            ) {
                                controllerWatching.promiseResolved = true;
                                controllerWatching.resolve(undefined);
                            }
                        });
                },
                error: (_data, code) => {
                    // console.log('easyServer.error', {_data, controllerWatching})
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        `exit code ${code}`,
                        { isDataPath: true },
                    );
                    clearTimeout(timer);
                    controller = null;
                    if (this.offlineAuthPending) {
                        // 离线授权未激活：保留当前任务等待用户输入授权码，
                        // 写入 auth.json 后由 submitOfflineAuth 重新拉起。
                        return;
                    }
                    // 与 success 同理：进程异常退出时若队列中仍有任务，先重新拉起该
                    // 任务并继续等待其结果，避免把未执行的任务直接判为失败。
                    hasMoreQueue()
                        .then((redispatched) => {
                            if (redispatched) {
                                return;
                            }
                            if (
                                controllerWatching.reject &&
                                !controllerWatching.promiseResolved
                            ) {
                                controllerWatching.promiseResolved = true;
                                controllerWatching.reject(undefined);
                            }
                        })
                        .catch((e) => {
                            Log.error("easyServer.hasMoreQueue.error", e);
                            if (
                                controllerWatching.reject &&
                                !controllerWatching.promiseResolved
                            ) {
                                controllerWatching.promiseResolved = true;
                                controllerWatching.reject(undefined);
                            }
                        });
                },
            });
        } else if (configJsonPath) {
            const queueName = `${Date.now()}.queue.json`;
            const queuePath =
                this.ServerInfo.localPath + `/aigcpanel-queue/${queueName}`;
            await Files.copy(configJsonPath, queuePath);
            this.ServerApi.file.appendText(
                this.ServerInfo.logFile,
                `Another task is running, queued at ${queueName}`,
                { isDataPath: true },
            );
        }
    };
    this._callFunc = async function (
        data: ServerFunctionDataType,
        configCalculator: (data: ServerFunctionDataType) => Promise<any>,
        resultDataCalculator: (
            data: ServerFunctionDataType,
            launcherResult: LauncherResultType,
        ) => Promise<any>,
        option: {
            timeout: number;
        },
    ) {
        option = Object.assign(
            {
                timeout: 24 * 3600,
            },
            option,
        );
        const resultData = {
            // success, retry
            type: "success",
            start: 0,
            end: 0,
            data: {},
        };
        if (this.isRunning) {
            resultData.type = "retry";
            return {
                code: 0,
                msg: "ok",
                data: resultData,
            };
        }
        this.isRunning = true;
        resultData.start = Date.now();
        let configJsonPath = null;
        try {
            this.send("taskRunning", { id: data.id });
            // 权重未就绪直接抛错（提示等待下载完成），不阻塞调用
            await this.ensurePreparedOrThrow();
            const configData = await configCalculator(data);
            configData.setting = this.ServerInfo.setting;
            configJsonPath =
                await this.ServerApi.launcherPrepareConfigJson(configData);
            // console.log('EasyServer.envMap', envMap)
            const launcherResult: LauncherResultType = {
                result: {},
                endTime: null,
            };
            // console.log('easyServer.start', JSON.stringify({command, envMap, configData}))
            await (async () => {
                return new Promise((resolve, reject) => {
                    controllerWatching.id = data.id;
                    controllerWatching.launcherResult = launcherResult;
                    controllerWatching.resolve = resolve;
                    controllerWatching.reject = reject;
                    controllerWatching.promiseResolved = false;
                    me._controllerRunIfNeeded(configJsonPath, option);
                });
            })();
            resultData.end = Date.now();
            resultData.data = await resultDataCalculator(data, launcherResult);
            // console.log('easyServer.end', launcherResult)
            await Files.deletes(configJsonPath);
            return {
                code: 0,
                msg: "ok",
                data: resultData,
            };
        } catch (e) {
            throw e;
        } finally {
            this.isRunning = false;
        }
    };
    this.soundTts = async function (data: ServerFunctionDataType) {
        // console.log('soundTts', {data, serverInfo: this.ServerInfo})
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "soundTts",
                        param: data.param,
                        text: data.text,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.soundClone = async function (data: ServerFunctionDataType) {
        // console.log('soundClone', {data, serverInfo: this.ServerInfo})
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "soundClone",
                        param: data.param,
                        text: data.text,
                        promptAudio: data.promptAudio,
                        promptText: data.promptText,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.videoGen = async function (data: ServerFunctionDataType) {
        // console.log('videoGen', JSON.stringify({data, serverInfo: this.ServerInfo}))
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "videoGen",
                        param: data.param,
                        video: data.video,
                        audio: data.audio,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.asr = async function (data: ServerFunctionDataType) {
        // console.log('videoGen', JSON.stringify({data, serverInfo: this.ServerInfo}))
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "asr",
                        audio: data.audio,
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("records" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    records: launcherResult.result.records,
                };
            },
        );
    };
    this.textToImage = async function (data: ServerFunctionDataType) {
        // console.log('textToImage', {data, serverInfo: this.ServerInfo})
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "textToImage",
                        prompt: data.prompt,
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.imageToImage = async function (data: ServerFunctionDataType) {
        // console.log('imageToImage', {data, serverInfo: this.ServerInfo})
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "imageToImage",
                        image: data.image,
                        prompt: data.prompt,
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.textToVideo = async function (data: ServerFunctionDataType) {
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "textToVideo",
                        prompt: data.prompt,
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.imageToVideo = async function (data: ServerFunctionDataType) {
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "imageToVideo",
                        images: data.images || [],
                        prompt: data.prompt,
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };

    // 读取 config.json general[].result 声明的业务字段名列表，
    // 用于判断通用模型任务是否真正产出了结果。
    this._generalResultNames = function (funcName: string): string[] {
        const generalList = (me.serverConfig.general || []) as {
            name?: string;
            result?: { name?: string }[];
        }[];
        const def = generalList.find(
            (g) => g && g.name === (funcName || "general"),
        );
        if (!def || !Array.isArray(def.result)) {
            return [];
        }
        return def.result
            .map((r) => r && r.name)
            .filter((name): name is string => !!name);
    };

    // 通用模型调用（工具"通用模型"）：
    // 系统无法识别的模型在 config.json 声明 general 数组（param + result），
    // 平台按其 param 渲染表单提交，此处把参数透传给服务端；结果直接透传
    // stdout 返回的 json（字段名与 config.json general[].result 的 name 对应，
    // 前端按 result 定义解析展示，输出类型仅 file / files / text 三种）。
    this.general = async function (data: ServerFunctionDataType) {
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: data.funcName || "general",
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                const result = launcherResult.result || {};
                // 模型执行失败：优先抛出错误信息（如显存不足 / 崩溃侦测）
                if (result.error) {
                    throw result.error;
                }
                if (result.msg) {
                    throw result.msg;
                }
                // 校验任务是否真正产出了结果：
                // - config.json general[].result 声明了输出字段时，至少产出一个才算成功；
                // - 未声明输出字段时，退化为要求结束标记 End。
                // 否则说明模型进程异常退出（如启动即崩溃，launcher 本地模式仍以
                // 退出码 0 结束）或错误被吞掉只剩一个 End，不能当作成功。
                const resultNames = me._generalResultNames(
                    data.funcName || "general",
                );
                const succeeded =
                    resultNames.length > 0
                        ? resultNames.some((name) => name in result)
                        : !!result.End;
                if (!succeeded) {
                    throw t("error.runFailedCheckLog");
                }
                // 透传服务端结果 json（含 url/images/files/text/records 等字段）
                return result;
            },
        );
    };
};
