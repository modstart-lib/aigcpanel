import {app, Menu} from "electron";
import {isDev, isMac} from "../lib/env";
import {t} from "./lang";

let contextMenu: Electron.Menu;

const ready = () => {
    const menuTemplate: Electron.MenuItemConstructorOptions[] = [];
    if (isMac) {
        menuTemplate.push({
            label: app.name,
            submenu: [
                {label: `${t("menu.about")}${app.name}`, role: "about"},
                {type: "separator"},
                // {
                //     label: t("设置"),
                //     click: () => {
                //         createSettingWindow();
                //     },
                //     accelerator: "CmdOrCtrl+,",
                // },
                // {type: "separator"},
                {label: t("menu.services"), role: "services"},
                {type: "separator"},
                {label: `${t("menu.hide")} ${app.name}`, role: "hide"},
                {label: t("menu.hideOthers"), role: "hideOthers"},
                {label: t("menu.showAll"), role: "unhide"},
                {type: "separator"},
                {label: t("menu.quit"), role: "quit"},
            ],
        });
    }
    menuTemplate.push({
        label: t("menu.edit"),
        submenu: [
            {label: t("menu.undo"), accelerator: "CmdOrCtrl+Z", role: "undo"},
            {label: t("menu.redo"), accelerator: "Shift+CmdOrCtrl+Z", role: "redo"},
            {type: "separator"},
            {label: t("menu.cut"), accelerator: "CmdOrCtrl+X", role: "cut"},
            {label: t("menu.copy"), accelerator: "CmdOrCtrl+C", role: "copy"},
            {label: t("menu.paste"), accelerator: "CmdOrCtrl+V", role: "paste"},
            {label: t("menu.selectAll"), accelerator: "CmdOrCtrl+A", role: "selectAll"},
        ],
    });
    if (isDev) {
        menuTemplate.push({
            label: t("menu.view"),
            submenu: [
                {label: t("menu.reload"), role: "reload"},
                {label: t("menu.forceReload"), role: "forceReload"},
                {label: t("menu.devTools"), role: "toggleDevTools"},
                {type: "separator"},
                {label: t("menu.actualSize"), role: "resetZoom", accelerator: ""},
                {label: t("menu.zoomIn"), role: "zoomIn"},
                {label: t("menu.zoomOut"), role: "zoomOut"},
                {type: "separator"},
                {label: t("menu.fullscreen"), role: "togglefullscreen"},
            ],
        });
    }
    // menuTemplate.push({
    //     label: t("帮助"),
    //     role: "help",
    //     submenu: [
    //         // {
    //         //     label: t("教程帮助"),
    //         //     click: () => {
    //         //         createHelpWindow();
    //         //     },
    //         // },
    //         // {type: "separator"},
    //         // {
    //         //     label: t("关于"),
    //         //     click: () => {
    //         //         PageAbout.open().then()
    //         //     },
    //         // },
    //     ],
    // })
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
};

export const ConfigMenu = {
    ready,
};
