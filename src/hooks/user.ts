import { computed, ref } from "vue";
import { useUserStore } from "../store/modules/user";
import { useSettingStore } from "../store/modules/setting";

const setting = useSettingStore();

export const useUserPage = ({ web, status }) => {
    const webPreload = ref("");
    const webUrl = ref("");
    const webUserAgent = window.$mapi.app.getUserAgent();

    const user = useUserStore();
    const canGoBack = ref(false);

    const whiteUrl = [
        "/app_manager/user",
        
        "/login",
        "/register",
        "/logout",
    ];
    const urlMap = {
        "/app_manager/user": "/member",
    };

    const getUrl = () => {
        const url = web.value.getURL();
        return new URL(url).pathname;
    };

    const getCanGoBack = () => {
        if (whiteUrl[0] === getUrl()) {
            return false;
        }
        return true;
    };
    const doBack = async () => {
        web.value.loadURL(await user.webUrl());
    };

    const onMount = async () => {
        web.value.addEventListener("did-fail-load", (event: any) => {
            status.value?.setStatus("fail");
        });
        web.value.addEventListener("did-finish-load", (event: any) => {
            if (setting.shouldDarkMode()) {
                web.value.executeJavaScript(
                    `document.body.setAttribute('data-theme', 'dark');`,
                );
            }
        });
        web.value.addEventListener("close", (event: any) => {
            if (web.value.isDevToolsOpened()) {
                web.value.closeDevTools();
            }
        });
        web.value.addEventListener("dom-ready", (e) => {
            // web.value.openDevTools();
            window.$mapi.user.refresh();
            canGoBack.value = getCanGoBack();
            web.value.executeJavaScript(`
document.addEventListener('click', (event) => {
    const target = event.target;
    if (target.tagName !== 'A') return;
    let url = target.href
    if(url.startsWith('javascript:')) return;
    let urlPath = new URL(url).pathname;
    const urlMap = ${JSON.stringify(urlMap)};
    if(urlMap[urlPath]) {
        urlPath = urlMap[urlPath];
        const urlNew = new URL(url);
        urlNew.pathname = urlPath;
        url = urlNew.toString();
    }
    const whiteList = ${JSON.stringify(whiteUrl)};
    if (whiteList.includes(urlPath)) return;
    event.preventDefault();
    window.$mapi.user.openWebUrl(url)
});
`);
            status.value?.setStatus("success");
            if (window.__page) {
                window.__page.registerCallPage(
                    "ready",
                    (resolve, reject, data) => {
                        web.value.executeJavaScript(
                            `var call = function(){
                            if(!window.__appManagerUserReady){
                                setTimeout(call,10);
                                return;
                            };
                            window.__appManagerUserReady(${JSON.stringify(data)});
                         };call();`,
                        );
                        resolve(undefined);
                    },
                );
            }
        });
        status.value?.setStatus("loading");
        webPreload.value = await window.$mapi.app.getPreload();
        webUrl.value = await user.webUrl();
    };

    return {
        webPreload,
        webUrl,
        webUserAgent,
        user,
        canGoBack,
        doBack,
        onMount,
    };
};


