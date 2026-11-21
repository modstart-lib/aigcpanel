import electron from "electron";
import date from "date-and-time";
import path from "node:path";
import { AppEnv } from "../env";
import fs from "node:fs";
import dayjs from "dayjs";
import FileIndex from "../file";

let fileName = null;
let fileStream = null;
let appFileNames = {};
let appFileStreams = {};

const stringDatetime = () => {
    return date.format(new Date(), "YYYYMMDD");
};

const jsonStringifyLogData = (data: any) => {
    return JSON.stringify(data, (key, value) => {
        if (typeof value === "string" && value.length > 200) {
            if (
                value.startsWith("data:") ||
                value.substring(0, 190).match(/^[a-zA-Z0-9+/=]+\s*$/)
            ) {
                return (
                    value.substring(0, 100) + "...(length=" + value.length + ")"
                );
            }
        }
        return value;
    });
};

// 统一日志目录：系统日志与应用日志统一写入 <dataRoot>/logs
// （dataRoot = <userData>/data，即 .../aigcpanel/data/logs）
const logsDir = () => {
    return path.join(AppEnv.dataRoot, "logs");
};

const root = () => {
    return logsDir();
};

const file = () => {
    return path.join(logsDir(), "log_" + stringDatetime() + ".log");
};

const appFile = (name: string) => {
    return path.join(logsDir(), name + "_" + stringDatetime() + ".log");
};

const cleanOldLogs = (keepDays: number) => {
    if (!fs.existsSync(logsDir())) {
        return;
    }
    const files = fs.readdirSync(logsDir());
    const now = new Date();
    // console.log('cleanOldLogs', logsDir(), files)
    for (let file of files) {
        const filePath = path.join(logsDir(), file);
        let date = null;
        for (let s of file.split(/[_\\.]/)) {
            // 匹配 YYYYMMDD
            if (s.match(/^\d{8}$/)) {
                date = s;
                break;
            }
        }
        if (!date) {
            continue;
        }
        const fileDate = new Date(
            parseInt(date.substring(0, 4)),
            parseInt(date.substring(4, 6)) - 1,
            parseInt(date.substring(6, 8)),
        );
        const diff = Math.abs(now.getTime() - fileDate.getTime());
        const diffDays = Math.ceil(diff / (1000 * 3600 * 24));
        // console.log('fileDate', file, fileDate, diffDays)
        if (diffDays > keepDays) {
            fs.unlinkSync(filePath);
        }
    }
};

const log = (level: "INFO" | "ERROR", label: string, data: any = null) => {
    if (fileName !== file()) {
        fileName = file();
        const logDir = logsDir();
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }
        if (fileStream) {
            fileStream.end();
        }
        fileStream = fs.createWriteStream(fileName, { flags: "a" });
        cleanOldLogs(14);
    }
    let line = [];
    line.push(date.format(new Date(), "YYYY-MM-DD HH:mm:ss"));
    line.push(level);
    line.push(label);
    if (data) {
        if (!["number", "string"].includes(typeof data)) {
            data = jsonStringifyLogData(data);
        }
        line.push(data);
    }
    console.log(line.join(" - "));
    fileStream.write(line.join(" - ") + "\n");
};

const info = (label: string, data: any = null) => {
    return log("INFO", label, data);
};
const error = (label: string, data: any = null) => {
    return log("ERROR", label, data);
};

const appLog = (
    name: string,
    level: "INFO" | "ERROR",
    label: string,
    data: any = null,
) => {
    let fileChanged = false;
    if (appFileNames[name] !== appFile(name)) {
        appFileNames[name] = appFile(name);
        fileChanged = true;
    }
    if (fileChanged || !appFileStreams[name]) {
        if (appFileStreams[name]) {
            appFileStreams[name].end();
        }
        const logDir = logsDir();
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir);
        }
        appFileStreams[name] = fs.createWriteStream(appFileNames[name], {
            flags: "a",
        });
    }
    let line = [];
    line.push(date.format(new Date(), "YYYY-MM-DD HH:mm:ss"));
    line.push(level);
    line.push(label);
    if (data) {
        if (!["number", "string"].includes(typeof data)) {
            data = JSON.stringify(data);
        }
        line.push(data);
    }
    console.log(`[APP:${name}] - ` + line.join(" - "));
    appFileStreams[name].write(line.join(" - ") + "\n");
};

const appPath = (name: string) => {
    if (!appFileNames[name]) {
        appFileNames[name] = appFile(name);
    }
    return appFileNames[name];
};

const appInfo = (name: string, label: string, data: any = null) => {
    return appLog(name, "INFO", label, data);
};
const appError = (name: string, label: string, data: any = null) => {
    return appLog(name, "ERROR", label, data);
};

const infoRenderOrMain = (label: string, data: any = null) => {
    if (electron.ipcRenderer) {
        console.log("Log.info", label, data);
        return electron.ipcRenderer.invoke("log:info", label, data);
    } else {
        return info(label, data);
    }
};
const errorRenderOrMain = (label: string, data: any = null) => {
    if (electron.ipcRenderer) {
        console.error("Log.error", label, data);
        return electron.ipcRenderer.invoke("log:error", label, data);
    } else {
        return error(label, data);
    }
};

const appInfoRenderOrMain = (name: string, label: string, data: any = null) => {
    if (electron.ipcRenderer) {
        console.log("Log.appInfo", name, label, data);
        return electron.ipcRenderer.invoke("log:appInfo", name, label, data);
    } else {
        return appInfo(name, label, data);
    }
};

const appErrorRenderOrMain = (
    name: string,
    label: string,
    data: any = null,
) => {
    if (electron.ipcRenderer) {
        console.error("Log.appError", name, label, data);
        return electron.ipcRenderer.invoke("log:appError", name, label, data);
    } else {
        return appError(name, label, data);
    }
};

const collectRenderOrMain = async (option?: {
    startTime?: string;
    endTime?: string;
    limit?: number;
}) => {
    option = Object.assign(
        {
            startTime: dayjs().subtract(1, "day").format("YYYY-MM-DD HH:mm:ss"),
            endTime: dayjs().format("YYYY-MM-DD HH:mm:ss"),
            limit: 10 * 10000,
        },
        option,
    );
    let startMs = dayjs(option.startTime).valueOf();
    let endMs = dayjs(option.endTime).valueOf();
    let startDayMs = dayjs(option.startTime).startOf("day").valueOf();
    let endDayMs = dayjs(option.endTime).endOf("day").valueOf();
    let resultLines = [];
    let logFiles = [];
    logFiles = logFiles.concat(
        await FileIndex.list(logsDir(), { isDataPath: false }),
    );
    // console.log('logFiles', logFiles)
    logFiles = logFiles.filter((logFile) => {
        if (logFile.isDirectory) {
            return false;
        }
        let date = null;
        for (let s of logFile.name.split(/[_\\.]/)) {
            // 匹配 YYYYMMDD
            if (s.match(/^\d{8}$/)) {
                date = s;
                break;
            }
        }
        if (!date) {
            return false;
        }
        const fileDate = new Date(
            parseInt(date.substring(0, 4)),
            parseInt(date.substring(4, 6)) - 1,
            parseInt(date.substring(6, 8)),
        );
        if (fileDate.getTime() < startDayMs || fileDate.getTime() > endDayMs) {
            return false;
        }
        return true;
    });
    // console.log('collectRenderOrMain', {
    //     ...option,
    //     logFiles, startMs, endMs, startDayMs, endDayMs
    // })
    for (const logFile of logFiles) {
        await FileIndex.readLine(
            logFile.pathname,
            (line) => {
                const lineParts = line.split(" - ");
                const lineTime = dayjs(lineParts[0]);
                // console.log('lineTime', lineParts[0], lineTime.isBefore(startMs) || lineTime.isAfter(endMs))
                if (lineTime.isBefore(startMs) || lineTime.isAfter(endMs)) {
                    return;
                }
                resultLines.push(line);
            },
            { isDataPath: false },
        );
    }
    return {
        startTime: option.startTime,
        endTime: option.endTime,
        logs: resultLines.join("\n"),
    };
};

export default {
    root,
    info,
    error,
    infoRenderOrMain,
    errorRenderOrMain,
    appPath,
    appInfo,
    appError,
    appInfoRenderOrMain,
    appErrorRenderOrMain,
    collectRenderOrMain,
    jsonStringifyLogData,
};

export const Log = {
    jsonStringifyLogData,
    info: infoRenderOrMain,
    error: errorRenderOrMain,
    appPath,
    appInfo: appInfoRenderOrMain,
    appError: appErrorRenderOrMain,
};
