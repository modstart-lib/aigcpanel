import dayjs from "dayjs";
import {Base64} from "js-base64";
import {t} from "../lang";

export const sleep = (time = 1000) => {
    return new Promise(resolve => {
        setTimeout(() => resolve(true), time);
    });
};

export const wait = (callback: () => boolean | Promise<boolean>, interval = 10, timeout = 3600) => {
    const startTime = Date.now();
    return new Promise(resolve => {
        const timer = setInterval(async () => {
            if (Date.now() - startTime > timeout * 1000) {
                clearInterval(timer);
                resolve(false);
                return;
            }
            let res = callback();
            if (res instanceof Promise) {
                res = await res;
            }
            if (res) {
                clearInterval(timer);
                resolve(true);
            }
        }, interval);
    });
};

/**
 * 精确计时器
 * @param callback
 * @param interval
 * @returns
 */
export function preciseInterval(callback: () => void, interval: number) {
    let expected = performance.now() + interval;
    let stop = false;

    function step(timestamp: number) {
        if (stop) return;
        if (timestamp >= expected) {
            callback();
            // 累积期望的时间，以保持精确的间隔
            expected += interval;
        }
        requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
    // 返回一个对象包含取消方法
    return {
        cancel: () => {
            stop = true;
        }
    };
}

export const StringUtil = {
    random(length: number = 16) {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    uuid: () => {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    },
    replaceParam: (str: string, param: any) => {
        return str.replace(/{(.*?)}/g, (match: string, key: string) => {
            return param[key] || match;
        });
    },
};

export const TimeUtil = {
    timestamp() {
        return Math.floor(Date.now() / 1000);
    },
    datetimeToTimestamp(datetime: string) {
        return dayjs(datetime).unix();
    },
    timestampMS() {
        return Date.now();
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
        return dayjs().format("YYYYMMDD_HHmmss");
    },
    secondsToTime(seconds: number, showMs: boolean = false) {
        const sec = Math.floor(seconds);
        const ms = Math.floor((seconds - sec) * 1000);
        let h: any = Math.floor(sec / 3600);
        let m: any = Math.floor((sec % 3600) / 60);
        let s: any = Math.floor(sec % 60);
        if (h < 10) h = "0" + h;
        if (m < 10) m = "0" + m;
        if (s < 10) s = "0" + s;
        const result = "00" == h ? `${m}:${s}` : `${h}:${m}:${s}`;
        if (showMs) {
            let f: any = ms;
            if (f < 10) f = "00" + f;
            else if (f < 100) f = "0" + f;
            return `${result}.${f}`;
        }
        return result;
    },
    msToTime(ms: number) {
        return this.secondsToTime(ms / 1000, true);
    },
    secondsToHuman(seconds: number) {
        seconds = parseInt(seconds.toString());
        let h: any = Math.floor(seconds / 3600);
        let m: any = Math.floor((seconds % 3600) / 60);
        let s: any = Math.floor(seconds % 60);
        const result: string[] = [];
        if (h > 0) result.push(`${h}${t("time.hour")}`);
        if (m > 0) result.push(`${m}${t("time.minute")}`);
        if (s > 0) result.push(`${s}${t("time.second")}`);
        return result.join("");
    },
    replacePattern(text: string) {
        return text
            .replaceAll("{year}", dayjs().format("YYYY"))
            .replaceAll("{month}", dayjs().format("MM"))
            .replaceAll("{day}", dayjs().format("DD"))
            .replaceAll("{hour}", dayjs().format("HH"))
            .replaceAll("{minute}", dayjs().format("mm"))
            .replaceAll("{second}", dayjs().format("ss"));
    },
};

export const EncodeUtil = {
    base64Encode(str: string) {
        return Base64.encode(str);
    },
    base64Decode(str: string) {
        return Base64.decode(str);
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
        if (match.startsWith(">=") && this.ge(v, match.substring(2))) {
            return true;
        }
        if (match.startsWith(">") && this.gt(v, match.substring(1))) {
            return true;
        }
        if (match.startsWith("<=") && this.le(v, match.substring(2))) {
            return true;
        }
        if (match.startsWith("<") && this.lt(v, match.substring(1))) {
            return true;
        }
        return this.eq(v, match);
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

export const BrowserUtil = {
    isMac() {
        return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    },
    isWindows() {
        return navigator.platform.toUpperCase().indexOf("WIN") >= 0;
    },
    isLinux() {
        return navigator.platform.toUpperCase().indexOf("LINUX") >= 0;
    },
};

export const ShellUtil = {
    quotaPath(p: string) {
        return `"${p}"`;
    },
};

export const ObjectUtil = {
    clone(obj: any) {
        return JSON.parse(JSON.stringify(obj));
    },
};

export const DownloadUtil = {
    downloadFile(content: string, filename?: string) {
        const blob = new Blob([content], {type: "application/octet-stream"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename || `download_${TimeUtil.datetimeString()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
};
