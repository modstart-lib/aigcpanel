import enUS from "./../../src/lang/en-US.json";
import zhCN from "./../../src/lang/zh-CN.json";
import {isDev} from "../lib/env";
import {ConfigMain} from "../mapi/config/main";

export const defaultLocale = "zh-CN";

let locale = defaultLocale;

export const langMessageList = [
    {
        name: "en-US",
        label: "English",
        messages: enUS,
    },
    {
        name: "zh-CN",
        label: "简体中文",
        messages: zhCN,
    },
];

const buildMessages = (): any => {
    let messages = {};
    for (let m of langMessageList) {
        messages[m.name] = m.messages;
    }
    return messages;
};

let messages = buildMessages();

export const t = (text: string, param: object | null = null) => {
    if (messages[locale]) {
        if (messages[locale][text]) {
            if (param) {
                return messages[locale][text].replace(/\{(\w+)\}/g, function (match, key) {
                    return key in param ? param[key] : match;
                });
            }
            return messages[locale][text];
        }
    }
    if (param) {
        return text.replace(/\{(\w+)\}/g, function (match, key) {
            return key in param ? param[key] : match;
        });
    }
    return text;
};

const readyAsync = async () => {
    locale = await ConfigMain.get("lang", defaultLocale);
};

const getLocale = () => {
    return locale;
};

export const ConfigLang = {
    readyAsync,
    getLocale,
};
