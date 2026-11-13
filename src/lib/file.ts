import SparkMD5 from "spark-md5";
import { t } from "../lang";

export const FileUtil = {
    extensionToType(extension: string) {
        const mime = {
            mp3: "audio/mpeg",
            wav: "audio/wav",
            mp4: "video/mp4",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            svg: "image/svg+xml",
        };
        return mime[extension] || "";
    },
    bufferToBlob(buffer: ArrayBuffer, type: string) {
        if (!type.indexOf("/")) {
            type = this.extensionToType(type);
        }
        return new Blob([buffer], { type: type });
    },
    base64ToBuffer(base64: string) {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    },
    blobToFile(blob: Blob, name: string) {
        return new File([blob], name);
    },
    urlToBlob(url: string): Promise<Blob> {
        return fetch(url).then((res) => res.blob());
    },
    blobToBase64Url(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.onerror = (e) => {
                reject(e);
            };
            reader.readAsDataURL(blob);
        });
    },
    getExt(path: string) {
        const ext = path.lastIndexOf(".");
        if (ext >= 0) {
            return path.substring(ext + 1).toLowerCase();
        }
        return "";
    },
    // Convert a local file:// url to a filesystem path (plain paths stay unchanged)
    urlToPath(url: string): string {
        let p = url + "";
        if (/^file:\/\//i.test(p)) {
            p = p.replace(/^file:\/\//i, "");
            try {
                p = decodeURIComponent(p);
            } catch {
                // keep the raw path when it cannot be decoded
            }
            // windows drive path: /C:/xxx -> C:/xxx
            if (/^\/[a-zA-Z]:[\\/]/.test(p)) {
                p = p.substring(1);
            }
        }
        return p;
    },
    getBaseName(path: string, withExt: boolean = false) {
        // windows
        if (path.includes("\\")) {
            path = path.replace(/\\/g, "/");
        }
        const last = path.lastIndexOf("/");
        if (last >= 0) {
            path = path.substring(last + 1);
        }
        if (!withExt) {
            const ext = path.lastIndexOf(".");
            if (ext >= 0) {
                path = path.substring(0, ext);
            }
            return path;
        }
        return path;
    },
    async md5File(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!SparkMD5) {
                reject(new Error("SparkMD5 not found"));
                return;
            }
            const chunkSize = 2097152; // Read in chunks of 2MB
            const chunks = Math.ceil(file.size / chunkSize);
            let currentChunk = 0;
            const spark = new SparkMD5.ArrayBuffer();
            const fileReader = new FileReader();

            fileReader.onload = (e: any) => {
                if (e.target.error) {
                    reject(e.target.error);
                    return;
                }
                spark.append(e.target.result); // Append array buffer
                currentChunk++;
                if (currentChunk < chunks) {
                    loadNext();
                } else {
                    const md5 = spark.end();
                    resolve(md5);
                }
            };

            fileReader.onerror = () => {
                reject(fileReader.error);
            };

            function loadNext() {
                const start = currentChunk * chunkSize;
                const end =
                    start + chunkSize >= file.size
                        ? file.size
                        : start + chunkSize;
                fileReader.readAsArrayBuffer(file.slice(start, end));
            }

            loadNext();
        });
    },
    async md5Stream(stream: ReadableStream<Uint8Array>): Promise<string> {
        if (!SparkMD5) {
            throw new Error("SparkMD5 not found");
        }
        const reader = stream.getReader();
        const spark: any = new SparkMD5.ArrayBuffer();

        return new Promise((resolve, reject) => {
            function processChunk() {
                reader
                    .read()
                    .then(({ done, value }) => {
                        if (done) {
                            const md5 = spark.end();
                            resolve(md5);
                            return;
                        }
                        if (value) {
                            spark.append(value.buffer);
                        }
                        processChunk();
                    })
                    .catch((err) => {
                        reject(err);
                    });
            }

            processChunk();
        });
    },
    formatSize: (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    },
};

/**
 * Fail fast with an actionable error when a local input file is gone.
 *
 * A task can run long after it was submitted: the user may have moved or
 * deleted the source video/audio in the meantime. Without this check the
 * failure only surfaces deep inside ffprobe/ffmpeg as a cryptic message such
 * as "Could not retrieve media duration", which does not tell the user that
 * their input file is missing.
 */
export const assertLocalFileExists = async (
    path: string,
    option?: {
        // i18n key used for the error message, {path} is substituted
        message?: string;
    },
): Promise<void> => {
    // Remote inputs (http/rtmp/...) cannot be checked on the local filesystem.
    if (/^(https?|rtmp|rtsp|tcp|udp):\/\//i.test(path || "")) {
        return;
    }
    // Accept file:// urls as well as plain filesystem paths.
    const localPath = FileUtil.urlToPath(path || "");
    if (localPath && (await $mapi.file.exists(localPath))) {
        return;
    }
    throw t(option?.message || "error.inputFileNotExists", {
        path: path || "-",
    });
};
