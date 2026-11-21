import { StorageUtil } from "./storage";

const NAV_TAB_KEY = "nav-tab-memory";

const readMap = (): Record<string, string> => {
    const map = StorageUtil.getObject(NAV_TAB_KEY) as Record<string, string>;
    return map && typeof map === "object" ? map : {};
};

/** 记住指定页面最近停留的二级菜单 tab */
export const rememberNavTab = (path: string, tab: string): void => {
    if (!path || !tab) {
        return;
    }
    const map = readMap();
    if (map[path] === tab) {
        return;
    }
    map[path] = tab;
    StorageUtil.set(NAV_TAB_KEY, map);
};

/** 读取指定页面最近停留的二级菜单 tab，未记录时返回空串 */
export const getNavTab = (path: string): string => {
    return readMap()[path] || "";
};
