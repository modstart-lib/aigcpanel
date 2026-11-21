<template>
    <a-config-provider :locale="locale" :global="true">
        <div class="window-container">
            <div
                class="window-header flex h-10 items-center border-b border-solid border-gray-200"
            >
                <div class="window-header-title flex-grow flex items-center">
                    <div class="pl-2 py-2">
                        <img src="/logo.svg" class="w-4 t-4" />
                    </div>
                    <div
                        class="p-2 flex-grow truncate overflow-hidden text-ellipsis max-w-96"
                    >
                        {{ pageTitle }}
                    </div>
                </div>
                <div class="p-1 leading-4">
                    <div
                        class="inline-flex items-center justify-center w-6 h-6 cursor-pointer hover:text-red-500"
                        @click="doClose"
                    >
                        <i-mdi-close class="text-sm" />
                    </div>
                </div>
            </div>
            <div class="window-body">
                <component :is="props.page" @event="onEvent" />
            </div>
        </div>
    </a-config-provider>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { onLocaleChange } from "../lang";

import zhCN from "@arco-design/web-vue/es/locale/lang/zh-cn";
import enUS from "@arco-design/web-vue/es/locale/lang/en-us";

const locales = {
    "zh-CN": zhCN,
    "en-US": enUS,
};

const props = defineProps<{
    name: string;
    title: string;
    page: any;
}>();

const pageTitleCustom = ref<string>("");
const pageTitle = computed(() => {
    if (pageTitleCustom.value) {
        return pageTitleCustom.value;
    }
    return props.title;
});

const onEvent = (type: string, data: any) => {
    // console.log('Page.onEvent', type, data)
    if (type === "SetTitle") {
        pageTitleCustom.value = data.title;
    }
};

const doClose = async () => {
    await window.$mapi.app.windowClose(props.name);
};

const locale = ref(zhCN);
onLocaleChange((newLocale) => {
    locale.value = locales[newLocale];
});
</script>
