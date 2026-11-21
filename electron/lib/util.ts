import chardet from "chardet";
import dayjs from "dayjs";
import iconvLite from "iconv-lite";
import { Base64 } from "js-base64";
import * as crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Showdown from "showdown";
// import {Iconv} from "iconv"
import { isMac, isWin } from "./env";
import FileIndex from "../mapi/file";

export const EncodeUtil = {
    base32Alphabet: "abcdefghijklmnopqrstuvwxyz234567",
    base32Encode(str: string) {
        const buffer = Buffer.from(str, "utf8");
        let bits = "";
        let output = "";
        // 将每个字节转为8位二进制
        for (let i = 0; i < buffer.length; i++) {
            const byte = buffer[i];
            bits += byte.toString(2).padStart(8, "0");
        }
        // 每5位一组，转为 Base32 字符
        for (let i = 0; i < bits.length; i += 5) {
            const chunk = bits.slice(i, i + 5);
            const paddedChunk = chunk.padEnd(5, "0"); // 不足5位补0
            const index = parseInt(paddedChunk, 2);
            output += EncodeUtil.base32Alphabet[index];
        }
        return output;
    },
    base32Decode(str: string) {
        const base32Alphabet = "abcdefghijklmnopqrstuvwxyz234567";
        let bits = "";
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const index = base32Alphabet.indexOf(char);
            if (index === -1) {
                throw new Error("Invalid Base32 character: " + char);
            }
            bits += index.toString(2).padStart(5, "0");
        }

        const bytes: number[] = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            const byte = bits.slice(i, i + 8);
            bytes.push(parseInt(byte, 2));
        }

        return Buffer.from(bytes).toString("utf8");
    },
    base64Encode(str: string) {
        return Base64.encode(str);
    },
    base64Decode(str: string) {
        return Base64.decode(str);
    },
    md5(str: string) {
        return crypto.createHash("md5").update(str).digest("hex");
    },
    aesEncode(str: string, key: string) {
        const cipher = crypto.createCipheriv("aes-128-ecb", key, "");
        let crypted = cipher.update(str, "utf8", "base64");
        crypted += cipher.final("base64");
        return crypted;
    },
    aesDecode(str: string, key: string) {
        const decipher = crypto.createDecipheriv("aes-128-ecb", key, "");
        let dec = decipher.update(str, "base64", "utf8");
        dec += decipher.final("utf8");
        return dec;
    },
    async fileXzipEncode(pathname: string): Promise<string> {
        if (!fs.existsSync(pathname)) {
            throw new Error(`Input file not found: ${pathname}`);
        }

        // Generate new filepath with .xzip extension
        const basePath = pathname.substring(0, pathname.lastIndexOf("."));
        const outputPath = basePath + ".xzip";

        // Get file info
        const fileStats = fs.statSync(pathname);
        const fileSize = fileStats.size;
        const fileExt = pathname.split(".").pop() || "";

        // Generate random 16-character key
        const encryptionKey = StrUtil.randomString(16);

        // Create metadata
        const filemeta = {
            version: 1,
            format: fileExt,
            size: fileSize,
            key: encryptionKey,
        };

        // Convert metadata to JSON and then base64 encode
        const metaJson = JSON.stringify(filemeta);
        const metaB64 = Buffer.from(metaJson, "utf-8").toString("base64");
        const metaLength = metaB64.length;

        // Prepare encryption key
        const keyBytes = Buffer.from(encryptionKey, "utf-8");
        const keyLength = keyBytes.length;

        // Stream processing: read, encrypt and write in chunks
        const inputStream = fs.createReadStream(pathname);
        const outputStream = fs.createWriteStream(outputPath);

        // Write metadata length (4 bytes, little-endian)
        const metaLengthBuffer = Buffer.allocUnsafe(4);
        metaLengthBuffer.writeUInt32LE(metaLength, 0);
        outputStream.write(metaLengthBuffer);

        // Write base64 encoded metadata
        outputStream.write(Buffer.from(metaB64, "utf-8"));

        // Stream encrypt the file content
        let bytesProcessed = 0;
        return new Promise((resolve, reject) => {
            inputStream.on("data", (chunk: Buffer) => {
                // XOR encrypt the chunk
                const encryptedChunk = Buffer.alloc(chunk.length);
                for (let i = 0; i < chunk.length; i++) {
                    encryptedChunk[i] =
                        chunk[i] ^ keyBytes[bytesProcessed % keyLength];
                    bytesProcessed++;
                }

                // Write encrypted chunk
                outputStream.write(encryptedChunk);
            });

            inputStream.on("end", () => {
                outputStream.end();
                resolve(outputPath);
            });

            inputStream.on("error", (error) => {
                outputStream.destroy();
                reject(error);
            });

            outputStream.on("error", (error) => {
                inputStream.destroy();
                reject(error);
            });
        });
    },
    async fileXzipDecode(pathname: string): Promise<string> {
        if (!fs.existsSync(pathname)) {
            throw new Error(`Input file not found: ${pathname}`);
        }

        if (!pathname.endsWith(".xzip")) {
            return pathname; // Not an xzip file, return as is
        }

        let outputPath = pathname.replace(/\.xzip$/, "");

        return new Promise((resolve, reject) => {
            const inputStream = fs.createReadStream(pathname);
            let metadataRead = false;
            let filemeta: any = null;
            let keyBytes: Buffer;
            let bytesProcessed = 0;
            let outputStream: fs.WriteStream;
            let remainingMetaBytes = 0;
            let metaBuffer = Buffer.alloc(0);

            inputStream.on("data", (chunk: Buffer) => {
                let chunkOffset = 0;

                if (!metadataRead) {
                    if (remainingMetaBytes === 0) {
                        // Read metadata length (first 4 bytes)
                        if (chunk.length < 4) {
                            reject(
                                new Error(
                                    "Invalid xzip file: insufficient data for metadata length",
                                ),
                            );
                            return;
                        }
                        const metaLength = chunk.readUInt32LE(0);
                        remainingMetaBytes = metaLength;
                        chunkOffset = 4;
                    }

                    // Read metadata
                    const availableMetaBytes = Math.min(
                        remainingMetaBytes,
                        chunk.length - chunkOffset,
                    );
                    const metaChunk = chunk.subarray(
                        chunkOffset,
                        chunkOffset + availableMetaBytes,
                    );
                    metaBuffer = Buffer.concat([
                        metaBuffer,
                        metaChunk,
                    ] as readonly Uint8Array[]);
                    remainingMetaBytes -= availableMetaBytes;
                    chunkOffset += availableMetaBytes;

                    if (remainingMetaBytes === 0) {
                        // Parse metadata
                        try {
                            const metaB64 = metaBuffer.toString("utf-8");
                            const metaJson = Buffer.from(
                                metaB64,
                                "base64",
                            ).toString("utf-8");
                            filemeta = JSON.parse(metaJson);
                            keyBytes = Buffer.from(filemeta.key, "utf-8");

                            // Create output file with correct extension
                            const finalOutputPath =
                                outputPath +
                                (filemeta.format ? "." + filemeta.format : "");
                            outputStream =
                                fs.createWriteStream(finalOutputPath);
                            // 写流错误必须处理，否则会变成未捕获异常且 promise 永不结束
                            outputStream.on("error", (error) => {
                                inputStream.destroy();
                                reject(error);
                            });

                            metadataRead = true;

                            // Set the final output path for resolution
                            outputPath = finalOutputPath;
                        } catch (error) {
                            reject(
                                new Error(
                                    "Invalid xzip file: corrupted metadata",
                                ),
                            );
                            return;
                        }
                    }
                }

                if (metadataRead && chunkOffset < chunk.length) {
                    // Decrypt remaining chunk data
                    const encryptedChunk = chunk.subarray(chunkOffset);
                    const decryptedChunk = Buffer.alloc(encryptedChunk.length);
                    const keyLength = keyBytes.length;

                    for (let i = 0; i < encryptedChunk.length; i++) {
                        decryptedChunk[i] =
                            encryptedChunk[i] ^
                            keyBytes[bytesProcessed % keyLength];
                        bytesProcessed++;
                    }

                    outputStream.write(decryptedChunk);
                }
            });

            inputStream.on("end", () => {
                if (!outputStream) {
                    reject(new Error("Invalid xzip file: incomplete metadata"));
                    return;
                }
                // 必须等 write stream 写完（finish）再 resolve：
                // 之前提前 resolve 会出现「解码路径已返回但文件还没落盘/创建」，
                // 调用方紧接着 hubSave 就会报 HubSave.FileNotFound（Windows 上高发）。
                outputStream.once("finish", () => resolve(outputPath));
                outputStream.end();
            });

            inputStream.on("error", (error) => {
                if (outputStream) {
                    outputStream.destroy();
                }
                reject(error);
            });
        });
    },
};

export const IconvUtil = {
    convert(str: string, to?: string, from?: string) {
        if (!from) {
            from = chardet.detect(Buffer.from(str));
        }
        to = to || "utf8";
        const buffer = iconvLite.encode(str, from);
        return iconvLite.decode(buffer, to);
    },
    bufferToUtf8(buffer: Buffer) {
        const encoding = chardet.detect(buffer);
        // if ('ISO-2022-CN' === encoding) {
        //     const iconvInstance = new Iconv('ISO-2022-CN', 'UTF-8//TRANSLIT//IGNORE');
        //     return iconvInstance.convert(buffer).toString()
        // }
        return iconvLite.decode(buffer, encoding).toString();
    },
    detect(buffer: Uint8Array) {
        // detect str encoding
        return chardet.detect(buffer);
    },
};

export const StrUtil = {
    randomString(len: number = 32) {
        const chars =
            "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let result = "";
        for (let i = len; i > 0; --i) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    },
    uuid() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
            /[xy]/g,
            function (c) {
                const r = (Math.random() * 16) | 0;
                const v = c === "x" ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            },
        );
    },
    hashCode(str: string, length: number = 8) {
        let hash = 0;
        if (str.length === 0) return hash + "";
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        let result = Math.abs(hash).toString(16);
        if (result.length < length) {
            result = "0".repeat(length - result.length) + result;
        }
        return result;
    },
    hashCodeWithDuplicateCheck(
        str: string,
        check: string[],
        length: number = 8,
    ) {
        let code = this.hashCode(str, length);
        while (check.includes(code)) {
            code = this.uuid().substring(0, length);
        }
        return code;
    },
    bigIntegerId() {
        return [
            Date.now(),
            (Math.floor(Math.random() * 1000000) + "").padStart(6, "0"),
        ].join("");
    },
    ucFirst(str: string) {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
};

export const TimeUtil = {
    timestampInMs() {
        return Date.now();
    },
    timestamp() {
        return Math.floor(Date.now() / 1000);
    },
    format(time: number, format: string = "YYYY-MM-DD HH:mm:ss") {
        return dayjs(time).format(format);
    },
    formatDate(time: number) {
        return dayjs(time).format("YYYY-MM-DD");
    },
    dateString() {
        return dayjs().format("YYYYMMDD");
    },
    datetimeString() {
        return dayjs().format("YYYYMMDD_HHmmss_SSS");
    },
    timestampDayStart(msTimestamp?: number) {
        let date = msTimestamp ? new Date(msTimestamp) : new Date();
        date.setHours(0, 0, 0, 0);
        return Math.floor(date.getTime() / 1000);
    },
    replacePattern(text: string) {
        // @ts-ignore
        return text
            .replaceAll("{year}", dayjs().format("YYYY"))
            .replaceAll("{month}", dayjs().format("MM"))
            .replaceAll("{day}", dayjs().format("DD"))
            .replaceAll("{hour}", dayjs().format("HH"))
            .replaceAll("{minute}", dayjs().format("mm"))
            .replaceAll("{second}", dayjs().format("ss"));
    },
};

export const FileUtil = {
    MIME_TYPES: {
        html: "text/html",
        htm: "text/html",
        js: "application/javascript",
        css: "text/css",
        json: "application/json",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        webp: "image/webp",
        woff: "font/woff",
        woff2: "font/woff2",
        ttf: "font/ttf",
        otf: "font/otf",
        mp3: "audio/mpeg",
        mp4: "video/mp4",
        wav: "audio/wav",
        wasm: "application/wasm",
        eot: "application/vnd.ms-fontobject",
    },
    getMimeByExt(ext: string, defaultMime: string = ""): string {
        ext = ext.toLowerCase();
        if (ext.startsWith(".")) {
            ext = ext.substring(1);
        }
        return FileUtil.MIME_TYPES[ext] || defaultMime;
    },
    getMimeByPath(p: string, defaultMime: string = ""): string {
        const extension = p.split(".").pop().toLowerCase();
        return FileUtil.getMimeByExt(extension, defaultMime);
    },
    streamToBase64(stream: NodeJS.ReadableStream): Promise<string> {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on("data", (chunk) => {
                chunks.push(chunk);
            });
            stream.on("end", () => {
                const buffer = Buffer.concat(chunks);
                resolve(buffer.toString("base64"));
            });
            stream.on("error", (error) => {
                reject(error);
            });
        });
    },
    bufferToBase64(buffer: Buffer) {
        let binary = "";
        let bytes = new Uint8Array(buffer);
        let len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return EncodeUtil.base64Encode(binary);
    },
    base64ToBuffer(base64: string): Buffer {
        if (base64.startsWith("data:")) {
            base64 = base64.split("base64,")[1];
        }
        return Buffer.from(base64, "base64");
    },
    formatSize(size: number) {
        if (size < 1024) {
            return size + "B";
        } else if (size < 1024 * 1024) {
            return (size / 1024).toFixed(2) + "KB";
        } else if (size < 1024 * 1024 * 1024) {
            return (size / 1024 / 1024).toFixed(2) + "MB";
        } else {
            return (size / 1024 / 1024 / 1024).toFixed(2) + "GB";
        }
    },
    async md5(filePath: string) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash("md5");
            const stream = fs.createReadStream(filePath);
            stream.on("data", (data) => {
                hash.update(data);
            });
            stream.on("end", () => {
                resolve(hash.digest("hex"));
            });
            stream.on("error", (error) => {
                reject(error);
            });
        });
    },
};

export const JsonUtil = {
    stringifyOrdered(obj: any) {
        return JSON.stringify(obj, Object.keys(obj).sort(), 4);
    },
    stringifyValueOrdered(obj: any) {
        const sortedData = Object.fromEntries(
            Object.entries(obj).sort(([, a], [, b]) => {
                // @ts-ignore
                return ((a as any) - b) as any;
            }),
        );
        return JSON.stringify(sortedData, null, 4);
    },
};

export const ImportUtil = {
    async loadCommonJs(cjsPath: string, forceReload: boolean = true) {
        let tempPath = cjsPath;
        if (forceReload) {
            const md5 = await FileUtil.md5(cjsPath);
            tempPath = path.join(
                await FileIndex.tempDir("commonJs"),
                `${md5}.cjs`,
            );
            if (!fs.existsSync(tempPath)) {
                fs.copyFileSync(cjsPath, tempPath);
            }
        }
        const backend = await import(/* @vite-ignore */ `file://${tempPath}`);
        // console.log('loadCommonJs', `${cjsPath}?t=${md5}`)
        return backend.default;
    },
};

export const MemoryCacheUtil = {
    pool: {} as {
        [key: string]: {
            value: any;
            expire: number;
        };
    },
    _gc() {
        const now = TimeUtil.timestamp();
        for (const key in this.pool) {
            if (this.pool[key].expire < now) {
                delete this.pool[key];
            }
        }
    },
    async remember(
        key: string,
        callback: () => Promise<any>,
        ttl: number = 60,
    ) {
        if (this.pool[key] && this.pool[key].expire > TimeUtil.timestamp()) {
            return this.pool[key].value;
        }
        const value = await callback();
        this.pool[key] = {
            value,
            expire: TimeUtil.timestamp() + ttl,
        };
        this._gc();
        return value;
    },
    get(key: string) {
        if (this.pool[key] && this.pool[key].expire > TimeUtil.timestamp()) {
            return this.pool[key].value;
        }
        this._gc();
        return null;
    },
    set(key: string, value: any, ttl: number = 86400) {
        this.pool[key] = {
            value,
            expire: TimeUtil.timestamp() + ttl,
        };
        this._gc();
    },
    forget(key: string) {
        delete this.pool[key];
    },
};

export const MemoryMapCacheUtil = {
    pool: {} as {
        [group: string]: {
            [key: string]: {
                value: any;
                expire: number;
            };
        };
    },
    _gc() {
        const now = TimeUtil.timestamp();
        for (const group in this.pool) {
            for (const key in this.pool[group]) {
                if (this.pool[group][key].expire < now) {
                    delete this.pool[group][key];
                }
            }
        }
    },
    get(group: string, key: string) {
        if (
            this.pool[group] &&
            this.pool[group][key] &&
            this.pool[group][key].expire > TimeUtil.timestamp()
        ) {
            return this.pool[group][key].value;
        }
        this._gc();
        return null;
    },
    set(group: string, key: string, value: any, ttl: number = 86400) {
        if (!this.pool[group]) {
            this.pool[group] = {};
        }
        this.pool[group][key] = {
            value,
            expire: TimeUtil.timestamp() + ttl,
        };
        this._gc();
    },
    forget(group: string, key: string) {
        if (this.pool[group]) {
            delete this.pool[group][key];
        }
    },
};

export const ShellUtil = {
    quotaPath(p: string) {
        return `"${p}"`;
    },
    parseCommandArgs(command: string) {
        let args = [];
        let arg = "";
        let quote = "";
        let escape = false;
        for (let i = 0; i < command.length; i++) {
            const c = command[i];
            if (escape) {
                arg += c;
                escape = false;
                continue;
            }
            if ("\\" === c) {
                escape = true;
                arg += c;
                continue;
            }
            if ("" === quote && (" " === c || "\t" === c)) {
                if (arg) {
                    args.push(arg);
                    arg = "";
                }
                continue;
            }
            if ("" === quote && ('"' === c || "'" === c)) {
                quote = c;
                arg += c;
                continue;
            }
            if ('"' === quote && '"' === c) {
                quote = "";
                arg += c;
                continue;
            }
            if ("'" === quote && "'" === c) {
                quote = "";
                arg += c;
                continue;
            }
            arg += c;
        }
        if (arg) {
            args.push(arg);
        }
        return args;
    },
};

export const VersionUtil = {
    /**
     * 检测版本是否匹配
     * @param v string
     * @param match string 如 * 或 >=1.0.0 或 >1.0.0 或 <1.0.0 或 <=1.0.0 或 1.0.0
     */
    match(v: string, match: string) {
        if (match === "*") {
            return true;
        }
        if (match.startsWith(">=")) {
            if (this.ge(v, match.substring(2))) {
                return true;
            }
        } else if (match.startsWith("<=")) {
            if (this.le(v, match.substring(2))) {
                return true;
            }
        } else if (match.startsWith(">")) {
            if (this.gt(v, match.substring(1))) {
                return true;
            }
        } else if (match.startsWith("<")) {
            if (this.lt(v, match.substring(1))) {
                return true;
            }
        } else {
            return this.eq(v, match);
        }
        return false;
    },
    compare(v1: string, v2: string) {
        const v1Arr = v1.split(".");
        const v2Arr = v2.split(".");
        for (let i = 0; i < v1Arr.length; i++) {
            const v1Num = parseInt(v1Arr[i]);
            const v2Num = parseInt(v2Arr[i]);
            if (v1Num > v2Num) {
                return 1;
            } else if (v1Num < v2Num) {
                return -1;
            }
        }
        return 0;
    },
    gt(v1: string, v2: string) {
        return VersionUtil.compare(v1, v2) > 0;
    },
    ge(v1: string, v2: string) {
        return VersionUtil.compare(v1, v2) >= 0;
    },
    lt(v1: string, v2: string) {
        return VersionUtil.compare(v1, v2) < 0;
    },
    le: (v1: string, v2: string) => {
        return VersionUtil.compare(v1, v2) <= 0;
    },
    eq: (v1: string, v2: string) => {
        return VersionUtil.compare(v1, v2) === 0;
    },
};

export const UIUtil = {
    sizeToPx(size: string, sizeFull: number) {
        if (/^\d+$/.test(size)) {
            // 纯数字
            return parseInt(size);
        } else if (size.endsWith("%")) {
            // 百分比
            let result = Math.floor((sizeFull * parseInt(size)) / 100);
            result = Math.min(result, sizeFull);
            return result;
        } else {
            throw "UnsupportSizeString";
        }
    },
};

export const ReUtil = {
    match(regex: string, text: string) {
        if ("" === regex || null === regex) {
            return false;
        }
        if (regex.startsWith("/")) {
            const index = regex.lastIndexOf("/");
            const source = regex.slice(1, index);
            const flags = regex.slice(index + 1);
            return new RegExp(source, flags).test(text);
        }
        return new RegExp(regex).test(text);
    },
};

const converter = new Showdown.Converter({
    tables: true,
});
export const MarkdownUtil = {
    toHtml(markdown: string): string {
        return converter.makeHtml(markdown);
    },
};

type HotkeyModifierType =
    | "Control"
    | "Option"
    | "Command"
    | "Ctrl"
    | "Alt"
    | "Win"
    | "Meta"
    | "Shift";
type HotkeyType = { key: string; modifiers: HotkeyModifierType[] };

export const HotKeyUtil = {
    orderModifiers(modifiers: HotkeyModifierType[]) {
        const order = [
            "Control",
            "Ctrl",
            "Command",
            "Meta",
            "Win",
            "Option",
            "Alt",
            "Shift",
        ];
        return modifiers.sort((a, b) => {
            return order.indexOf(a) - order.indexOf(b);
        });
    },
    unifyObject(hotkey: HotkeyType) {
        return {
            key: hotkey.key.toUpperCase(),
            modifiers: this.orderModifiers(
                hotkey.modifiers.map((modifier) => StrUtil.ucFirst(modifier)),
            ),
        };
    },
    unifyString(hotkey: string): HotkeyType {
        const parts = hotkey.split("+");
        const key = parts.pop() || "";
        const modifiers: any[] = [];
        parts.forEach((part) => {
            modifiers.push(StrUtil.ucFirst(part.trim()));
        });
        return this.unifyObject({ key, modifiers });
    },
    unify(
        hotkeys: string | string[] | HotkeyType | HotkeyType[],
    ): HotkeyType[] {
        if (typeof hotkeys === "string") {
            return [this.unifyString(hotkeys)];
        } else if (Array.isArray(hotkeys)) {
            return hotkeys.map((hotkey) => {
                if (typeof hotkey === "string") {
                    return this.unifyString(hotkey);
                } else {
                    return this.unifyObject(hotkey);
                }
            });
        } else {
            return [this.unifyObject(hotkeys)];
        }
    },
    getFromEvent(event: any): HotkeyType | null {
        const valid = [
            "A",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H",
            "I",
            "J",
            "K",
            "L",
            "M",
            "N",
            "O",
            "P",
            "Q",
            "R",
            "S",
            "T",
            "U",
            "V",
            "W",
            "X",
            "Y",
            "Z",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "0",
            "Space",
        ];
        const key = (event.key || "").toUpperCase();
        if (!event || !event.key || !valid.includes(key)) {
            return null;
        }
        const modifiers: HotkeyModifierType[] = [];
        if (isWin) {
            if (event.ctrlKey || event.control) {
                modifiers.push("Ctrl");
            }
            if (event.altKey || event.alt) {
                modifiers.push("Alt");
            }
            if (event.metaKey || event.meta) {
                modifiers.push("Win");
            }
        } else if (isMac) {
            if (event.ctrlKey || event.control) {
                modifiers.push("Control");
            }
            if (event.altKey || event.alt) {
                modifiers.push("Option");
            }
            if (event.metaKey || event.meta) {
                modifiers.push("Command");
            }
        } else {
            if (event.ctrlKey || event.control) {
                modifiers.push("Ctrl");
            }
            if (event.altKey || event.alt) {
                modifiers.push("Alt");
            }
            if (event.metaKey || event.meta) {
                modifiers.push("Meta");
            }
        }
        if (event.shiftKey || event.shift) {
            modifiers.push("Shift");
        }
        return this.unifyObject({ key, modifiers });
    },
    match(hotkeysForMatch: HotkeyType[], hotkey: HotkeyType): boolean {
        if (!hotkeysForMatch || !hotkey) {
            return false;
        }
        const hotKeyStr = hotkey.modifiers.join("+") + "+" + hotkey.key;
        for (const key of hotkeysForMatch) {
            const keyStr = key.modifiers.join("+") + "+" + key.key;
            if (keyStr === hotKeyStr) {
                return true;
            }
        }
        return false;
    },
};
