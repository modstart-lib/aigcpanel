<script setup lang="ts">
import {onMounted, ref} from "vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";

const env = ref({
    hubRoot: null as string | null,
    hubRootDefault: null as string | null,
});
const doLoad = async () => {
    env.value.hubRoot = await window.$mapi.config.get("hubRoot", "");
    env.value.hubRootDefault = await window.$mapi.file.hubRootDefault();
};

onMounted(doLoad);

const doSelectHubRootPath = async (useDefault: boolean) => {
    let dir;
    if (useDefault) {
        dir = await window.$mapi.file.hubRootDefault();
    } else {
        dir = await window.$mapi.file.openDirectory();
    }
    if (dir) {
        Dialog.confirm(t("setting.pathChangeConfirm", {path: dir})).then(() => {
            window.$mapi.config.set("hubRoot", dir).then(() => {
                window.$mapi.app.quit();
            });
        });
    }
};

const doOpen = () => {
    window.$mapi.app.openPath(env.value.hubRoot || env.value.hubRootDefault || "");
};
</script>

<template>
    <a-form-item field="name" :label="t('setting.storagePath')">
        <a-input readonly :placeholder="env.hubRootDefault as string" v-model="env.hubRoot as string">
            <template #append>
                <div @click="doSelectHubRootPath(false)" class="cursor-pointer pl-3">
                    {{ t("common.selectPath") }}
                </div>
            </template>
        </a-input>
        <template #help>
            <div class="flex items-center mt-2">
                <a-button
                    size="mini"
                    class="mr-2"
                    @click="doSelectHubRootPath(true)"
                    v-if="env.hubRoot && env.hubRoot !== env.hubRootDefault"
                >
                    {{ t("common.restoreDefault") }}
                </a-button>
                <a-button size="mini" class="mr-2" @click="doOpen()">
                    {{ t("common.openPath") }}
                </a-button>
                <div>
                    {{ t("setting.pathChangeRestart") }}
                </div>
            </div>
        </template>
    </a-form-item>
</template>

<style scoped></style>
