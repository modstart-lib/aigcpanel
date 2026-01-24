import {useServerStore} from "../store/modules/server";
import {EnumServerType} from "../types/Server";
import {Dialog} from "../lib/dialog";
import {t} from "../lang";

const serverStore = useServerStore();
export const PermissionService = {
    async checkForTask(
        biz: string,
        data: {
            serverName: string;
            serverVersion: string;
        }
    ) {
        const server = await serverStore.getByNameVersion(data.serverName, data.serverVersion);
        if (!server) {
            throw "ServerNotFound";
        }
        if (server.type === EnumServerType.CLOUD) {
            Dialog.loadingOn(t("status.submitting"));
            const user = await window.$mapi.user.get();
            if (!user.user.id) {
                Dialog.loadingOff();
                window.$mapi.user.open().then();
                return false;
            }
            const res = await window.$mapi.user.apiPost(
                "aigcpanel/task/check",
                {
                    model: data.serverName,
                    version: data.serverVersion,
                },
                {
                    throwException: false,
                }
            );
            Dialog.loadingOff();
            if (res.code) {
                Dialog.tipError(res.msg);
                setTimeout(() => {
                    if (res.data && res.data.type) {
                        if ("CreditNotEnough" === res.data.type) {
                            window.$mapi.user.open().then();
                        }
                    }
                }, 3000);
                return false;
            }
        }
        return true;
    },
};
