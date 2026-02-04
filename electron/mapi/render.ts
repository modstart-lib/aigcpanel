import {exposeContext} from "./util";
import {AppEnv} from "./env";

import config from "./config/render";
import log from "./log/render";
import app from "./app/render";
import storage from "./storage/render";
import db from "./db/render";
import file from "./file/render";
import event from "./event/render";
import ui from "./ui/render";
import updater from "./updater/render";
import statistics from "./statistics/render";
import user from "./user/render";
import misc from "./misc/render";

import server from "./server/render";

export const MAPI = {
    init(env: typeof AppEnv = null) {
        if (!env) {
            // expose context
            exposeContext("$mapi", {
                app,
                log,
                config,
                storage,
                db,
                file,
                event,
                ui,
                updater,
                statistics,
                user,
                misc,
                server,
            });
            db.init();
            event.init();
            ui.init();
        } else {
            // init context
            AppEnv.appRoot = env.appRoot;
            AppEnv.appData = env.appData;
            AppEnv.userData = env.userData;
            AppEnv.dataRoot = env.dataRoot;
            AppEnv.isInit = true;
        }
    },
};
