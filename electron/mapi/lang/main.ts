import {Files} from "../file/main";
import {AppEnv} from "../env";
import {JsonUtil} from "../../lib/util";
import {ipcMain} from "electron";

const fileSyncer = {
    readJson: async function (file: string) {
        let filePath = [AppEnv.appRoot, file].join("/");
        const sourceContent = (await Files.read(filePath)) || "{}";
        return JSON.parse(sourceContent);
    },
    writeJson: async function (file: string, data: any, order: "key" | "value" = "key") {
        let filePath = [AppEnv.appRoot, file].join("/");
        let jsonString: any;
        if (order === "key") {
            jsonString = JsonUtil.stringifyOrdered(data);
        } else {
            jsonString = JsonUtil.stringifyValueOrdered(data);
        }
        await Files.write(filePath, jsonString);
    },
};


const mergeJson = {};
let mergeJsonIgnore = false;
let autoWriteTimer = null;

const readLang = async (name: string) => {
    const jsonLang = await fileSyncer.readJson(`src/lang/${name}.json`);
    if (!mergeJson[name]) {
        mergeJson[name] = {};
    }
    for (const k in mergeJson[name]) {
        if (!jsonLang[k]) {
            jsonLang[k] = mergeJson[name][k];
        }
    }
    return jsonLang;
}

const writeSourceKeyUse = async (key: string) => {
    const json = await fileSyncer.readJson("src/lang/source-use.json");
    if (!json[key]) {
        json[key] = 1;
    } else {
        json[key]++;
    }
    await fileSyncer.writeJson("src/lang/source-use.json", json, "value");
};

ipcMain.handle("lang:writeSourceKeyUse", async (_, key) => {
    await writeSourceKeyUse(key);
});

export default {
    writeSourceKeyUse,
};
