import iconv from "iconv-lite";
import { exec as _exec, spawn } from "node:child_process";
import net from "node:net";
import util from "node:util";
import { AppConfig } from "../../../src/config";
import {
    extraResolveBin,
    isLinux,
    isMac,
    isWin,
    platformArch,
    platformName,
    platformUUID,
    platformVersion,
} from "../../lib/env";
import { IconvUtil, ShellUtil, StrUtil } from "../../lib/util";
import { Log } from "../log/index";

const exec = util.promisify(_exec);

const outputStringConvert = (outputEncoding: "utf8" | "cp936", data: any) => {
    if (!data) {
        return "";
    }
    if (outputEncoding === "utf8") {
        return data.toString();
    }
    let dataEncoding = "binary";
    if (Buffer.isBuffer(data)) {
        dataEncoding = IconvUtil.detect(data as any);
        if ("UTF-8" === dataEncoding) {
            return data.toString("utf8");
        }
    }
    // dataEncoding UTF-8 cp936
    // dataEncoding ISO-8859-1 cp936
    // console.log('dataEncoding', dataEncoding, outputEncoding)
    return iconv.decode(Buffer.from(data, dataEncoding as any), outputEncoding);
};

const shell = async (
    command: string,
    option?: {
        cwd?: string;
        outputEncoding?: string;
        shell?: boolean;
    },
) => {
    option = Object.assign(
        {
            cwd: process.cwd(),
            outputEncoding: isWin ? "cp936" : "utf8",
            shell: true,
        },
        option,
    );
    const result = await exec(command, {
        env: { ...process.env },
        shell: option.shell,
        encoding: "binary",
        cwd: option["cwd"],
    } as any);
    return {
        stdout: outputStringConvert(
            option.outputEncoding as any,
            result.stdout,
        ),
        stderr: outputStringConvert(
            option.outputEncoding as any,
            result.stderr,
        ),
    };
};

const spawnShell = async (
    command: string | string[],
    option: {
        stdout?: (data: string, process: any) => void;
        stderr?: (data: string, process: any) => void;
        success?: (process: any) => void;
        error?: (msg: string, exitCode: number, process: any) => void;
        cwd?: string;
        outputEncoding?: string;
        env?: Record<string, any>;
        shell?: boolean;
    } | null = null,
): Promise<{
    stop: () => void;
    send: (data: any) => void;
    result: () => Promise<string>;
}> => {
    option = Object.assign(
        {
            cwd: process.cwd(),
            outputEncoding: isWin ? "cp936" : "utf8",
            env: {},
            shell: true,
        },
        option,
    );
    let commandEntry = "",
        args = [];
    if (Array.isArray(command)) {
        commandEntry = command[0];
        args = command.slice(1);
    } else {
        args = ShellUtil.parseCommandArgs(command);
        commandEntry = args.shift() as string;
    }
    Log.info("App.spawnShell", {
        commandEntry,
        args,
        option: {
            cwd: option["cwd"],
            outputEncoding: option["outputEncoding"],
        },
    });
    const spawnProcess = spawn(commandEntry, args, {
        env: { ...process.env, ...option.env },
        cwd: option["cwd"],
        shell: option.shell,
        encoding: "binary",
    } as any);
    let end = false;
    let isSuccess = false;
    let exitCode = -1;
    const stdoutList: string[] = [];
    const stderrList: string[] = [];
    spawnProcess.stdout?.on("data", (data) => {
        // console.log('App.spawnShell.stdout', data)
        let dataString = outputStringConvert(
            option.outputEncoding as any,
            data,
        );
        Log.info("App.spawnShell.stdout", dataString);
        stdoutList.push(dataString);
        option.stdout?.(dataString, spawnProcess);
    });
    spawnProcess.stderr?.on("data", (data) => {
        // console.log('App.spawnShell.stderr', data)
        let dataString = outputStringConvert(
            option.outputEncoding as any,
            data,
        );
        Log.info("App.spawnShell.stderr", dataString);
        stderrList.push(dataString);
        option.stderr?.(dataString, spawnProcess);
    });
    spawnProcess.on("exit", (code, signal) => {
        // console.log('App.spawnShell.exit', code)
        Log.info("App.spawnShell.exit", { code, signal });
        exitCode = code;
        if (isWin) {
            if (0 === code || 1 === code) {
                isSuccess = true;
            }
        } else {
            if (null === code || 0 === code) {
                isSuccess = true;
            }
        }
        if (isSuccess) {
            option.success?.(spawnProcess);
        } else {
            option.error?.(
                `command ${command} failed with code ${code}`,
                exitCode,
                spawnProcess,
            );
        }
        end = true;
    });
    spawnProcess.on("error", (err) => {
        // console.log('App.spawnShell.error', err)
        Log.info("App.spawnShell.error", err);
        option.error?.(err.toString(), -1, spawnProcess);
        end = true;
    });
    return {
        pid: spawnProcess.pid,
        stop: () => {
            Log.info("App.spawnShell.stop");
            if (isWin) {
                _exec(
                    `taskkill /pid ${spawnProcess.pid} /T /F`,
                    {
                        encoding: "binary",
                    },
                    (err, stdout, stderr) => {
                        if (stdout) {
                            stdout = outputStringConvert(
                                option.outputEncoding as any,
                                stdout,
                            );
                        }
                        if (stderr) {
                            stderr = outputStringConvert(
                                option.outputEncoding as any,
                                stderr,
                            );
                        }
                        Log.info(
                            "App.spawnShell.stop.taskkill",
                            JSON.parse(JSON.stringify({ err, stdout, stderr })),
                        );
                    },
                );
            } else {
                try {
                    spawnProcess.kill("SIGINT");
                } catch (e) {
                    Log.error("App.spawnShell.stop.error", e);
                }
            }
        },
        // 强制结束（SIGINT 无效时兜底）
        kill: () => {
            Log.info("App.spawnShell.kill");
            if (isWin) {
                _exec(
                    `taskkill /pid ${spawnProcess.pid} /T /F`,
                    { encoding: "binary" },
                    () => {},
                );
            } else {
                try {
                    spawnProcess.kill("SIGKILL");
                } catch (e) {
                    Log.error("App.spawnShell.kill.error", e);
                }
            }
        },
        send: (data) => {
            Log.info("App.spawnShell.send", data);
            spawnProcess.stdin.write(data);
        },
        result: async (): Promise<string> => {
            if (end) {
                return stdoutList.join("") + stderrList.join("");
            }
            return new Promise((resolve, reject) => {
                const watchEnd = () => {
                    setTimeout(() => {
                        if (!end) {
                            watchEnd();
                            return;
                        }
                        if (isSuccess) {
                            resolve(stdoutList.join("") + stderrList.join(""));
                        } else {
                            reject(
                                [
                                    `command ${command} failed with code ${exitCode} : `,
                                    stdoutList.join(""),
                                    stderrList.join(""),
                                ].join(""),
                            );
                        }
                    }, 10);
                };
                watchEnd();
            });
        },
    };
};

const spawnBinary = async (
    binary: string,
    args: string[],
    option: {
        stdout?: (data: string, process: any) => void;
        stderr?: (data: string, process: any) => void;
        success?: (process: any) => void;
        error?: (msg: string, exitCode: number, process: any) => void;
        cwd?: string;
        outputEncoding?: string;
        env?: Record<string, any>;
        shell?: boolean;
    } | null = null,
): Promise<string> => {
    args.unshift(extraResolveBin(binary));
    const res = await Apps.spawnShell(args, {
        ...(option || {}),
        shell: false,
    });
    return await res.result();
};

const availablePortLock: {
    [port: number]: {
        lockKey: string;
        lockTime: number;
    };
} = {};

/**
 * 获取一个可用的端口
 * @param start 开始的端口
 * @param lockKey 锁定的key，避免其他进程获取，默认会创建一个随机的key
 * @param lockTime 锁定时间，避免在本次获取后未启动服务导致其他进程重复获取
 */
const availablePort = async (
    start: number,
    lockKey?: string,
    lockTime?: number,
): Promise<number> => {
    lockKey = lockKey || StrUtil.randomString(8);
    lockTime = lockTime || 60;
    // expire lock
    const now = Date.now();
    for (const port in availablePortLock) {
        const lockInfo = availablePortLock[port];
        if (lockInfo.lockTime < now) {
            delete availablePortLock[port];
        }
    }
    for (let i = start; i < 65535; i++) {
        const available = await isPortAvailable(i, "0.0.0.0");
        const availableLocal = await isPortAvailable(i, "127.0.0.1");
        // console.log('isPortAvailable', i, available, availableLocal)
        if (available && availableLocal) {
            const lockInfo = availablePortLock[i];
            if (lockInfo) {
                if (lockInfo.lockKey === lockKey) {
                    return i;
                } else {
                    // other lockKey lock the port
                    continue;
                }
            }
            availablePortLock[i] = {
                lockKey,
                lockTime: Date.now() + lockTime * 1000,
            };
            return i;
        }
    }
    throw new Error("no available port");
};

const isPortAvailable = async (
    port: number,
    host?: string,
): Promise<boolean> => {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, host);
        server.on("listening", () => {
            server.close();
            resolve(true);
        });
        server.on("error", () => {
            resolve(false);
        });
    });
};

const fixExecutable = async (executable: string) => {
    if (isMac || isLinux) {
        // chmod +x executable
        await shell(`chmod +x "${executable}"`);
    }
};

const getUserAgent = () => {
    let param = [];
    param.push(`AppOpen/${AppConfig.name}/${AppConfig.version}`);
    param.push(
        `Platform/${platformName()}/${platformArch()}/${platformVersion()}/${platformUUID()}`,
    );
    return param.join(" ");
};

export const Apps = {
    shell,
    spawnShell,
    spawnBinary,
    availablePort,
    isPortAvailable,
    fixExecutable,
    getUserAgent,
};

export default Apps;
