import fs, { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { ReadableStream } from "node:stream/web";
import { EncodeUtil, StrUtil, TimeUtil } from "../../lib/util";
import Apps from "../app";
import { ConfigIndex } from "../config";
import { AppEnv, waitAppEnvReady } from "../env";
import { Log } from "../log";
import electron from "electron";
import { finished } from "stream/promises";

const nodePath = path;

const toNodeReadableStream = (stream: any) => {
    if (stream instanceof ReadableStream) {
        // 已经是 Node.js 版本的 WHATWG ReadableStream
        return Readable.fromWeb(stream);
    }
    if (typeof stream.getReader === "function") {
        // 浏览器版本 → 包装成 Node.js 兼容的
        const nodeStream = new ReadableStream({
            async pull(controller) {
                const reader = stream.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    controller.enqueue(value);
                }
                controller.close();
            },
        });
        return Readable.fromWeb(nodeStream);
    }
    throw new Error("Unsupported stream type");
};

const toWebReadableStream = (stream: any) => {
    const reader = stream[Symbol.asyncIterator]();
    return new window.ReadableStream({
        async pull(controller) {
            const { value, done } = await reader.next();
            if (done) {
                controller.close();
            } else {
                controller.enqueue(value);
            }
        },
    });
};

const root = () => {
    return AppEnv.dataRoot;
};

const absolutePath = (path: string) => {
    return `ABS://${path}`;
};

const fullPath = async (path: string) => {
    await waitAppEnvReady();
    if (path.startsWith("ABS://")) {
        return path.replace(/^ABS:\/\//, "");
    }
    return nodePath.join(root(), path);
};

const exists = async (
    path: string,
    option?: { isDataPath?: boolean },
): Promise<boolean> => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    return new Promise((resolve, reject) => {
        fs.stat(fp, (err, stat) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
};

const isDirectory = async (path: string, option?: { isDataPath?: boolean }) => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return false;
    }
    return fs.statSync(fp).isDirectory();
};

const mkdir = async (path: string, option?: { isDataPath?: boolean }) => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        fs.mkdirSync(fp, { recursive: true });
    }
};

const list = async (path: string, option?: { isDataPath?: boolean }) => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return [];
    }
    const files = fs.readdirSync(fp);
    const result = [];
    for (const file of files) {
        const pathname = nodePath.join(fp, file);
        let stat: fs.Stats;
        try {
            // 对损坏的软链接（目标不存在）statSync 会抛 ENOENT，
            // 此时跳过该条目，避免整个目录列表崩溃。
            stat = fs.statSync(pathname);
        } catch (e) {
            continue;
        }
        result.push({
            name: file,
            pathname,
            isDirectory: stat.isDirectory(),
            size: stat.size,
            lastModified: stat.mtimeMs,
        });
    }
    return result;
};

const listAll = async (path: string, option?: { isDataPath?: boolean }) => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return [];
    }
    const listDirectory = (path: string, basePath: string = "") => {
        let files = [];
        const list = fs.readdirSync(path);
        for (let file of list) {
            let stat: fs.Stats | null = null;
            try {
                // 对损坏的软链接（目标不存在）statSync 会抛 ENOENT，跳过避免崩溃
                stat = fs.statSync(nodePath.join(path, file));
            } catch (e) {
                continue;
            }
            let fPath = nodePath.join(basePath, file);
            fPath = fPath.replace(/\\/g, "/");
            let f = {
                name: file,
                path: fPath,
                isDirectory: stat.isDirectory(),
                size: stat.size,
                lastModified: stat.mtimeMs,
            };
            if (f.isDirectory) {
                files = files.concat(
                    listDirectory(nodePath.join(path, file), f.path),
                );
                continue;
            }
            files.push(f);
        }
        return files;
    };
    return listDirectory(fp);
};

const write = async (
    path: string,
    data: any,
    option?: { isDataPath?: boolean },
) => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    const fullPathDir = nodePath.dirname(fp);
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, { recursive: true });
    }
    if (typeof data === "string") {
        data = {
            content: data,
        };
    }
    const f = fs.openSync(fp, "w");
    fs.writeSync(f, data.content);
    fs.closeSync(f);
};

const writeStream = async (
    path: string,
    data: any,
    option?: { isDataPath?: boolean },
) => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    const fullPathDir = nodePath.dirname(fp);
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, { recursive: true });
    }
    if (electron.ipcRenderer) {
        data = toNodeReadableStream(data);
    }
    const fileStream = createWriteStream(fp);
    data.pipe(fileStream);
    await finished(fileStream);
};

const writeBuffer = async (
    path: string,
    data: any,
    option?: { isDataPath?: boolean },
) => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    const fullPathDir = nodePath.dirname(fp);
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, { recursive: true });
    }
    const f = fs.openSync(fp, "w");
    fs.writeSync(f, data);
    fs.closeSync(f);
};

const read = async (
    path: string,
    option?: {
        isDataPath?: boolean;
        encoding?: string;
    },
) => {
    option = Object.assign(
        {
            isDataPath: false,
            encoding: "utf8",
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return null;
    }
    const f = fs.openSync(fp, "r");
    const content = fs.readFileSync(f, {
        encoding: option.encoding as BufferEncoding,
    });
    fs.closeSync(f);
    return content;
};

const readBuffer = async (
    path: string,
    option?: { isDataPath?: boolean },
): Promise<Buffer> => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return null;
    }
    return new Promise((resolve, reject) => {
        fs.readFile(fp, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(data);
        });
    });
};

const readStream = async (path: string, option?: { isDataPath?: boolean }) => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        throw `FileNotFound: ${fp}`;
    }
    const stream = fs.createReadStream(fp);
    if (electron.ipcRenderer) {
        return toWebReadableStream(stream);
    }
    return stream;
};

const readLine = async (
    path: string,
    callback: (line: string) => void,
    option?: {
        isDataPath?: boolean;
    },
) => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    if (!fs.existsSync(fp)) {
        return;
    }
    return new Promise((resolve, reject) => {
        const f = fs.createReadStream(fp);
        let remaining = "";
        f.on("data", (chunk) => {
            remaining += chunk;
            let index = remaining.indexOf("\n");
            let last = 0;
            while (index > -1) {
                let line = remaining.substring(last, index);
                last = index + 1;
                callback(line);
                index = remaining.indexOf("\n", last);
            }
            remaining = remaining.substring(last);
        });
        f.on("end", () => {
            if (remaining.length > 0) {
                callback(remaining);
            }
            resolve(undefined);
        });
    });
};

const clean = async (paths: string[], option?: { isDataPath?: boolean }) => {
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
        return;
    }
    for (const path of paths) {
        try {
            await deletes(path, option);
        } catch (e) {
            Log.error(`CleanError: ${path}`, e);
        }
    }
};

const deletes = async (
    path: string,
    option?: { isDataPath?: boolean },
): Promise<void> => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    if (!(await exists(fp, { isDataPath: false }))) {
        return;
    }
    return new Promise((resolve, reject) => {
        fs.stat(fp, (err, stat) => {
            if (err) {
                reject(err);
                return;
            }
            if (stat.isDirectory()) {
                fs.rmdir(fp, { recursive: true }, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(undefined);
                });
            } else {
                fs.unlink(fp, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(undefined);
                });
            }
        });
    });
};
const rename = async (
    pathOld: string,
    pathNew: string,
    option?: {
        isDataPath?: boolean;
        overwrite?: boolean;
    },
) => {
    option = Object.assign(
        {
            isDataPath: false,
            overwrite: false,
        },
        option,
    );
    let fullPathOld = pathOld;
    let fullPathNew = pathNew;
    if (option.isDataPath) {
        fullPathOld = await fullPath(pathOld);
        fullPathNew = await fullPath(pathNew);
    }
    if (!fs.existsSync(fullPathOld)) {
        throw `Rename.FileNotFound - ${fullPathOld}`;
    }
    if (fs.existsSync(fullPathNew)) {
        if (!option.overwrite) {
            throw new Error(`FileAlreadyExists:${fullPathNew}`);
        }
        fs.unlinkSync(fullPathNew);
    }
    const dir = nodePath.dirname(fullPathNew);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    let success = false;
    try {
        fs.renameSync(fullPathOld, fullPathNew);
        success = true;
    } catch (e) {}
    if (!success) {
        // cross-device link not permitted, rename
        fs.copyFileSync(fullPathOld, fullPathNew);
        fs.unlinkSync(fullPathOld);
    }
};

const copy = async (
    pathOld: string,
    pathNew: string,
    option?: {
        isDataPath?: boolean;
        overwrite?: boolean;
    },
) => {
    option = Object.assign(
        {
            isDataPath: false,
            overwrite: false,
        },
        option,
    );
    let fullPathOld = pathOld;
    let fullPathNew = pathNew;
    if (option.isDataPath) {
        fullPathOld = await fullPath(pathOld);
        fullPathNew = await fullPath(pathNew);
    }
    if (!fs.existsSync(fullPathOld)) {
        throw `Copy.FileNotFound - ${fullPathOld}`;
    }
    if (fs.existsSync(fullPathNew)) {
        if (option.overwrite) {
            await deletes(fullPathNew, { isDataPath: false });
        } else {
            throw `Copy.FileAlreadyExists - ${fullPathNew}`;
        }
    }
    // console.log('copy', fullPathOld, fullPathNew)
    const dir = nodePath.dirname(fullPathNew);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(fullPathOld, fullPathNew);
};

// Effective data root directory (may be redirected via AIGCPANEL_DATA_ROOT)
const dataRoot = async (): Promise<string> => {
    await waitAppEnvReady();
    return root();
};

// Default Electron data root directory (<userData>/data when not redirected)
const dataRootDefault = async (): Promise<string> => {
    await waitAppEnvReady();
    return AppEnv.dataRootDefault;
};

// Whether the effective data root has been customized (differs from the default)
const isDataRootCustom = async (): Promise<boolean> => {
    await waitAppEnvReady();
    if (!AppEnv.dataRootDefault) {
        return false;
    }
    // Only trim trailing path separators to avoid false mismatches between Windows and *nix
    const normalize = (p: string) => (p || "").replace(/[\\/]+$/, "");
    return normalize(AppEnv.dataRoot) !== normalize(AppEnv.dataRootDefault);
};

const hubRootDefault = async () => {
    await waitAppEnvReady();
    return path.join(root(), "hub");
};

const hubRoot = async (): Promise<string> => {
    const hubDirDefault = await hubRootDefault();
    let hubDir = await ConfigIndex.get("hubRoot", "");
    if (!hubDir) {
        hubDir = hubDirDefault;
    }
    if (!fs.existsSync(hubDir)) {
        fs.mkdirSync(hubDir, { recursive: true });
    }
    return hubDir;
};

const _getHubSavePath = async (
    hubRoot: string,
    saveGroup: string,
    savePath: string,
    saveParam: {
        [key: string]: any;
    },
    ext: string,
    autoCreateDir: boolean = false,
) => {
    if (!saveGroup) {
        saveGroup = "file";
    }
    if (!savePath) {
        savePath = path.join(
            saveGroup,
            "{year}{month}{day}",
            "{hour}{minute}_{second}_{random}",
        );
    }
    savePath = savePath.replace(/\\/g, "/");
    if (savePath.endsWith(`.${ext}`)) {
        savePath = savePath.substring(0, savePath.length - ext.length - 1);
    }
    for (const key in saveParam) {
        // only allow alphanumeric, Chinese characters, and hyphens
        saveParam[key] = saveParam[key]
            .toString()
            .replace(/[^\w\u4e00-\u9fa5\-]/g, "");
        // length limit
        if (saveParam[key].length > 100) {
            saveParam[key] = saveParam[key].substring(0, 100);
        }
    }
    const param = {
        year: TimeUtil.replacePattern("{year}"),
        month: TimeUtil.replacePattern("{month}"),
        day: TimeUtil.replacePattern("{day}"),
        hour: TimeUtil.replacePattern("{hour}"),
        minute: TimeUtil.replacePattern("{minute}"),
        second: TimeUtil.replacePattern("{second}"),
        random: StrUtil.randomString(32),
        ...saveParam,
    };
    savePath = savePath.replace(/\{(\w+)\}/g, (match, key) => {
        return param[key] || key;
    });
    while (
        await exists(path.join(hubRoot, savePath + `.${ext}`), {
            isDataPath: false,
        })
    ) {
        savePath = savePath + `-${StrUtil.randomString(3)}`;
    }
    if (autoCreateDir) {
        const savePathFull = path.join(hubRoot, savePath);
        const dir = nodePath.dirname(savePathFull);
        if (!(await exists(dir, { isDataPath: false }))) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    return `${savePath}.${ext}`;
};

const hubDelete = async (
    file: string,
    option?: {
        isDataPath?: boolean;
        ignoreWhenNotInHub?: boolean;
        tryLaterWhenFailed?: boolean;
    },
) => {
    option = Object.assign(
        {
            isDataPath: false,
            ignoreWhenNotInHub: true,
            tryLaterWhenFailed: true,
        },
        option,
    );
    let fp = file;
    const hubRoot_ = await hubRoot();
    if (option.isDataPath) {
        fp = path.join(hubRoot_, file);
    }
    if (!(await isHubFile(fp))) {
        if (option.ignoreWhenNotInHub) {
            return;
        }
    }
    if (!(await exists(fp, { isDataPath: false }))) {
        throw `HubDelete.FileNotFound - ${fp}`;
    }
    const del = () => {
        deletes(fp, { isDataPath: false }).catch((err) => {
            if (option.tryLaterWhenFailed) {
                setTimeout(del, 1000);
            } else {
                Log.error(`HubDelete.Error: ${fp}`, err);
            }
        });
    };
    del();
};

const hubFullPath = async (file: string): Promise<string> => {
    if (!file) {
        throw "HubSave.FilePathEmpty";
    }
    const hubRoot_ = await hubRoot();
    return path.join(hubRoot_, file);
};

const hubFile = async (
    ext: string,
    option?: {
        returnFullPath?: boolean;
        autoCreateDir?: boolean;
        saveGroup?: string;
        savePath?: string;
        savePathParam?: {
            [key: string]: any;
        };
    },
) => {
    option = Object.assign(
        {
            returnFullPath: true,
            autoCreateDir: true,
            saveGroup: "file",
            savePath: null,
            savePathParam: {},
        },
        option,
    );
    if (!ext) {
        throw "HubSave.FilePathEmpty";
    }
    const hubRoot_ = await hubRoot();
    const savePath = await _getHubSavePath(
        hubRoot_,
        option.saveGroup,
        option.savePath,
        option.savePathParam,
        ext,
        option.autoCreateDir,
    );
    if (option.returnFullPath) {
        return path.join(hubRoot_, savePath);
    }
    return savePath;
};

const isHubFile = async (file: string) => {
    const hubRoot_ = await hubRoot();
    return inDir(file, hubRoot_);
};

const hubSave = async (
    file: string,
    option?: {
        ext?: string;
        returnFullPath?: boolean;
        ignoreWhenInHub?: boolean;
        cleanOld?: boolean;
        saveGroup?: string;
        savePath?: string;
        savePathParam?: {
            [key: string]: any;
        };
    },
) => {
    option = Object.assign(
        {
            ext: null,
            returnFullPath: true,
            ignoreWhenInHub: false,
            cleanOld: false,
            saveGroup: "file",
            savePath: null,
            savePathParam: {},
        },
        option,
    );
    if (!file) {
        throw "HubSave.FilePathEmpty";
    }
    if (!fs.existsSync(file)) {
        throw `HubSave.FileNotFound - ${file}`;
    }
    if (!option.ext) {
        option.ext = ext(file);
    }
    const hubRoot_ = await hubRoot();
    if (option.ignoreWhenInHub) {
        if (inDir(file, hubRoot_)) {
            return file;
        }
    }
    const savePath = await _getHubSavePath(
        hubRoot_,
        option.saveGroup,
        option.savePath,
        option.savePathParam,
        option.ext,
    );
    const savePathFull = path.join(hubRoot_, savePath);
    if (option.cleanOld) {
        await rename(file, savePathFull, { isDataPath: false });
        if (await exists(file, { isDataPath: false })) {
            deletes(file, { isDataPath: false }).then();
        }
    } else {
        await copy(file, savePathFull, {
            isDataPath: false,
        });
    }
    if (option.returnFullPath) {
        return savePathFull.replace(/\\/g, "/");
    }
    return savePath.replace(/\\/g, "/");
};

const hubSaveContent = async (
    content: string,
    option: {
        ext: string;
        returnFullPath?: boolean;
        saveGroup?: string;
        savePath?: string;
        savePathParam?: {
            [key: string]: any;
        };
    },
) => {
    option = Object.assign(
        {
            ext: null,
            returnFullPath: true,
            saveGroup: "file",
            savePath: null,
            savePathParam: {},
        },
        option,
    );
    const hubRoot_ = await hubRoot();
    const savePath = await _getHubSavePath(
        hubRoot_,
        option.saveGroup,
        option.savePath,
        option.savePathParam,
        option.ext,
    );
    const savePathFull = path.join(hubRoot_, savePath);
    await write(savePathFull, content, { isDataPath: false });
    if (option.returnFullPath) {
        return savePathFull.replace(/\\/g, "/");
    }
    return savePath.replace(/\\/g, "/");
};

const tempRoot = async () => {
    await waitAppEnvReady();
    const tempDir = path.join(root(), "temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
};

const autoCleanTemp = async (keepDays: number = 7) => {
    const root = await tempRoot();
    if (!fs.existsSync(root)) {
        return;
    }
    const files = fs.readdirSync(root);
    const now = new Date();
    for (const file of files) {
        const filePath = path.join(root, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            continue; // skip directories
        }
        const lastModified = new Date(stat.mtimeMs);
        const diffDays = Math.floor(
            (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (diffDays >= keepDays) {
            fs.unlinkSync(filePath);
            Log.info("AutoCleanTemp.Clean", filePath);
        } else {
            // console.log('AutoCleanTemp.Skip', filePath, diffDays);
        }
    }
};

const tempName = async (
    ext: string = "tmp",
    prefix: string = "file",
    suffix: string = "",
): Promise<string> => {
    const parts = [prefix, TimeUtil.timestampInMs(), StrUtil.randomString(32)];
    if (suffix) {
        parts.push(suffix);
    }
    const p = parts.join("_");
    return `${p}.${ext}`;
};

const temp = async (
    ext: string = "tmp",
    prefix: string = "file",
    suffix: string = "",
): Promise<string> => {
    const root = await tempRoot();
    return path.join(root, await tempName(ext, prefix, suffix));
};

const tempDir = async (prefix: string = "dir"): Promise<string> => {
    const root = await tempRoot();
    const p = [prefix, TimeUtil.timestampInMs(), StrUtil.randomString(32)].join(
        "_",
    );
    const dir = path.join(root, p);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
};

const watchText = async (
    path: string,
    callback: (data: {}) => void,
    option?: {
        isDataPath?: boolean;
        limit?: number;
    },
): Promise<{
    stop: Function;
}> => {
    if (!path) {
        throw new Error("path is empty");
    }
    option = Object.assign(
        {
            isDataPath: false,
            limit: 0,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    let watcher = null;
    let fd = null;
    let isFirstReading = true;
    let firstReadingLines = [];
    const watchFileExists = () => {
        if (fs.existsSync(fp)) {
            watcher = null;
            watchFileContent();
            return;
        }
        watcher = setTimeout(() => {
            watchFileExists();
        }, 1000);
    };
    const watchFileContent = () => {
        const CHUNK_SIZE = 16 * 1024;
        const fd = fs.openSync(fp, "r");
        let position = 0;
        let lineNumber = 0;
        let content = "";
        const parseContentLine = () => {
            while (true) {
                const index = content.indexOf("\n");
                if (index < 0) {
                    break;
                }
                const line = content.substring(0, index);
                content = content.substring(index + 1);
                const lineItem = {
                    num: lineNumber++,
                    text: line,
                };
                if (option.limit > 0 && isFirstReading) {
                    // 限制显示模式并且是第一次读取，暂时先不回调
                    firstReadingLines.push(lineItem);
                    while (firstReadingLines.length >= option.limit) {
                        firstReadingLines.shift();
                    }
                } else {
                    callback(lineItem);
                }
                // console.log('watchText.line', line, content)
            }
        };
        const readChunk = () => {
            const buf = new Buffer(CHUNK_SIZE);
            const bytesRead = fs.readSync(fd, buf, 0, CHUNK_SIZE, position);
            position += bytesRead;
            content += buf.toString("utf8", 0, bytesRead);
            parseContentLine();
            if (bytesRead < CHUNK_SIZE) {
                isFirstReading = false;
                if (firstReadingLines.length > 0) {
                    firstReadingLines.forEach((lineItem) => {
                        callback(lineItem);
                    });
                    firstReadingLines = [];
                }
                watcher = setTimeout(readChunk, 1000);
            } else {
                readChunk();
            }
        };
        readChunk();
    };
    watchFileExists();
    const stop = () => {
        // console.log('watchText stop', fp)
        if (fd) {
            fs.closeSync(fd);
        }
        if (watcher) {
            clearTimeout(watcher);
        }
    };
    // console.log('watchText', fp)
    return {
        stop,
    };
};

let appendTextPathCached = null;
let appendTextStreamCached = null;

const appendText = async (
    path: string,
    data: any,
    option?: { isDataPath?: boolean },
) => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    if (fp !== appendTextPathCached) {
        appendTextPathCached = fp;
        if (appendTextStreamCached) {
            appendTextStreamCached.end();
            appendTextStreamCached = null;
        }
        const fullPathDir = nodePath.dirname(fp);
        if (!fs.existsSync(fullPathDir)) {
            fs.mkdirSync(fullPathDir, { recursive: true });
        }
        appendTextStreamCached = fs.createWriteStream(fp, { flags: "a" });
    }
    appendTextStreamCached.write(data);
};

const download = async (
    url: string,
    path: string | null = null,
    option?: {
        isDataPath?: boolean;
        userAgent?: string;
        progress?: (percent: number, total: number) => void;
    },
): Promise<string> => {
    option = Object.assign(
        {
            isDataPath: false,
            userAgent: Apps.getUserAgent(),
            progress: null,
        },
        option,
    );
    if (!path) {
        const ext = FileIndex.ext(url);
        path = await temp(ext || "bin", "download");
        option.isDataPath = false;
    }
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    const fullPathDir = nodePath.dirname(fp);
    if (!fs.existsSync(fullPathDir)) {
        fs.mkdirSync(fullPathDir, { recursive: true });
    }
    const res = await fetch(url, {
        method: "GET",
        headers: {
            "User-Agent": option.userAgent,
        },
    });
    if (!res.ok) {
        throw new Error(`DownloadError:${url}`);
    }

    const contentLength = res.headers.get("content-length");
    const totalSize = contentLength ? parseInt(contentLength, 10) : null;
    let downloaded = 0;

    let readableStream = toNodeReadableStream(res.body);
    const fileStream = fs.createWriteStream(fp);
    return new Promise((resolve, reject) => {
        readableStream
            .on("data", (chunk) => {
                // console.log('download.data', chunk.length)
                downloaded += chunk.length;
                if (totalSize) {
                    option.progress &&
                        option.progress(downloaded / totalSize, totalSize);
                }
                fileStream.write(chunk);
            })
            .on("end", () => {
                // console.log('download.end')
                fileStream.end();
                resolve(fp);
            })
            .on("error", (err) => {
                // console.log('download.error', err)
                fileStream.close();
                reject(err);
            });
    });
};

/**
 * get file extension from file path or url
 * @param path
 */
const ext = (path: string) => {
    if (!path) {
        return "";
    }
    if (path.startsWith("http://") || path.startsWith("https://")) {
        // 处理 URL
        const url = new URL(path);
        path = url.pathname;
    }
    return nodePath.extname(path).replace(/^\./, "");
};

const stat = async (
    path: string,
    option?: { isDataPath?: boolean },
): Promise<{
    size: number;
    isDirectory: boolean;
    lastModified: number;
}> => {
    option = Object.assign(
        {
            isDataPath: false,
        },
        option,
    );
    let fp = path;
    if (option.isDataPath) {
        fp = await fullPath(path);
    }
    const stat = fs.statSync(fp);
    return {
        size: stat.size,
        isDirectory: stat.isDirectory(),
        lastModified: stat.mtimeMs,
    };
};

const textToName = (text: string, ext: string = "", maxLimit: number = 100) => {
    if (text) {
        // 转换为合法的文件名
        text = text.replace(/[\\\/\:\*\?\"\<\>\|]/g, "");
        text = text.replace(/[\r\n]/g, "");
        text = text.replace(/\s+/g, "");
        text = text.substring(0, maxLimit);
    }
    if (!text) {
        text = "EMPTY";
    }
    if (!ext) {
        return text;
    }
    return `${text}.${ext}`;
};

const inDir = (path: string, dir: string) => {
    if (!path || !dir) {
        return false;
    }
    path = path.replace(/\\/g, "/");
    dir = dir.replace(/\\/g, "/");
    if (path === dir) {
        return true;
    }
    return path.startsWith(dir);
};

const pathToName = (
    path: string,
    includeExt: boolean = true,
    maxLimit: number = 100,
) => {
    if (!path) {
        return "";
    }
    path = path.replace(/\\/g, "/");
    const parts = path.split("/");
    const nameWithExt = parts[parts.length - 1];
    const nameParts = nameWithExt.split(".");
    let ext = "";
    if (nameParts.length > 1) {
        ext = "." + nameParts.pop();
    }
    if (!includeExt) {
        ext = "";
    }
    let result = nameParts.join(".");
    maxLimit -= ext.length;
    if (maxLimit > 0 && result.length > maxLimit) {
        result = result.substring(0, maxLimit);
    }
    if (!result) {
        result = "EMPTY";
    }
    return `${result}${ext}`;
};

const _sortObjectDeep = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(_sortObjectDeep);
    } else if (obj && typeof obj === "object") {
        return Object.keys(obj)
            .sort()
            .reduce((acc, key) => {
                acc[key] = _sortObjectDeep(obj[key]);
                return acc;
            }, {} as any);
    }
    return obj;
};

const cacheKey = async (key: any): Promise<string> => {
    const keyObjString = JSON.stringify(_sortObjectDeep(key));
    const keyMd5 = EncodeUtil.md5(keyObjString);
    return path.join(await tempRoot(), `FileCache_${keyMd5}`);
};
const cacheForget = async (key: any): Promise<void> => {
    const keyPath = await cacheKey(key);
    if (await exists(keyPath)) {
        await deletes(keyPath);
    }
};
const cacheSet = async (key: any, data: any): Promise<void> => {
    const keyPath = await cacheKey(key);
    await write(keyPath, JSON.stringify(data));
};
const cacheGet = async (key: any): Promise<any | null> => {
    const keyPath = await cacheKey(key);
    if (!(await exists(keyPath))) {
        return null;
    }
    const content = await read(keyPath);
    if (!content) {
        return null;
    }
    try {
        return JSON.parse(content);
    } catch (e) {
        return null;
    }
};
const cacheGetPath = async (key: any): Promise<string | null> => {
    const p = await cacheGet(key);
    if (!p) {
        return null;
    }
    if (!(await exists(p))) {
        await cacheForget(key);
        return null;
    }
    return p;
};

export const FileIndex = {
    fullPath,
    absolutePath,
    exists,
    isDirectory,
    mkdir,
    list,
    listAll,
    write,
    writeStream,
    writeBuffer,
    read,
    readBuffer,
    readStream,
    readLine,
    clean,
    deletes,
    rename,
    copy,
    tempRoot,
    tempName,
    temp,
    tempDir,
    watchText,
    appendText,
    download,
    ext,
    stat,
    textToName,
    pathToName,
    dataRoot,
    dataRootDefault,
    isDataRootCustom,
    hubRootDefault,
    hubRoot,
    hubSave,
    hubSaveContent,
    hubDelete,
    hubFile,
    hubFullPath,
    isHubFile,
    cacheForget,
    cacheSet,
    cacheGetPath,
    cacheGet,
    autoCleanTemp,
};

export default FileIndex;
