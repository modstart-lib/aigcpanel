import {t} from "../lang";

export function mapError(msg: any) {
    if (typeof msg !== "string") {
        msg = msg.toString();
    }
    const map = {
        FileAlreadyExists: t("error.fileExists"),
        FileNotFound: t("error.fileNotFound"),
        ProcessTimeout: t("error.processTimeout"),
        RequestError: t("error.requestError"),
        ServerNotRunning: t("error.modelServiceNotRunning"),
    };
    for (let key in map) {
        if (msg.includes(key)) {
            let error = map[key];
            // regex PluginReleaseDocFormatError:-11
            const regex = new RegExp(`${key}:(-?\\d+)`);
            const match = msg.match(regex);
            if (match) {
                error += `(${match[1]})`;
            }
            return error;
        }
    }
    return msg;
}
