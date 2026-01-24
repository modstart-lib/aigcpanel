<script setup lang="ts">
import {nextTick, ref} from "vue";
import {useSettingStore} from "../store/modules/setting";

const visible = ref(false);
const remember = ref(false);
const setting = useSettingStore();
const exitMode = setting.configGet("exitMode", "");

const show = async () => {
    if (exitMode.value) {
        if (exitMode.value === "exit") {
            await doExit();
        } else if (exitMode.value === "hide") {
            await doHide();
        }
        return;
    }
    visible.value = true;
};

const doCancel = () => {
    visible.value = false;
};

const doHide = async () => {
    if (remember.value) {
        await setting.setConfig("exitMode", "hide");
    }
    visible.value = false;
    setTimeout(async () => {
        await window.$mapi.app.windowHide();
    }, 100);
};

const doExit = async () => {
    if (remember.value) {
        await setting.setConfig("exitMode", "exit");
    }
    visible.value = false;
    await window.$mapi.app.quit();
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="22rem"
        modal-class="pb-app-quit-confirm"
        :closable="true"
        :title="$t('common.tip')"
        title-align="start"
    >
        <template #footer>
            <a-button @click="doCancel">{{ $t("common.cancel") }}</a-button>
            <a-button @click="doExit">{{ $t("common.exit") }}</a-button>
            <a-button type="primary" @click="doHide">{{ $t("common.hideWindow") }}</a-button>
        </template>
        <div>
            <div class="text-center">{{ $t("common.exitConfirm") }}</div>
            <div class="text-center mt-4">
                <a-checkbox v-model="remember">
                    <span class="text-sm text-gray-500">{{ $t("common.rememberChoice") }}</span>
                </a-checkbox>
            </div>
        </div>
    </a-modal>
</template>

<style lang="less">
.pb-app-quit-confirm {
    .arco-modal-header {
        border-bottom: none;
    }

    .arco-modal-footer {
        border-top: none;
    }
}
</style>
