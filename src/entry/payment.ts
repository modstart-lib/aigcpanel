import {createApp} from "vue";
import store from "../store";

import ArcoVue, { Message } from "@arco-design/web-vue";
import "@arco-design/web-vue/dist/arco.css";
import ArcoVueIcon from "@arco-design/web-vue/es/icon";

import {i18n, t} from "../lang";

import {Dialog} from "../lib/dialog";
import "../style.less";

import {CommonComponents} from "../components/common";
import PagePayment from "../pages/PagePayment.vue";
import Page from "./Page.vue";

const app = createApp(Page, {
    name: "payment",
    title: t("page.payment.title"),
    page: PagePayment,
});
app.use(ArcoVue);
app.use(ArcoVueIcon);
app.use(CommonComponents);
app.use(i18n);
app.use(store);
Message._context = app._context;
app.config.globalProperties.$mapi = window.$mapi;
app.config.globalProperties.$dialog = Dialog;
app.config.globalProperties.$t = t as any;
app.mount("#app").$nextTick(() => {
    postMessage({payload: "removeLoading"}, "*");
});
