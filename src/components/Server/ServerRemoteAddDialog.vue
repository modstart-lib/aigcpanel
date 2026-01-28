<script setup lang="ts">
import axios from "axios";
import {ref, watch} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {useServerStore} from "../../store/modules/server";
import {EnumServerType, ServerRecord} from "../../types/Server";
import {StringUtil} from "../../lib/util";

const serverStore = useServerStore();
const visible = ref(false);
const loading = ref(false);
const remoteUrl = ref("");
const logStatus = ref("");
const fetchedConfig = ref<any>(null);
const validatedUrl = ref("");

const show = () => {
    remoteUrl.value = "http://127.0.0.1:8888";
    logStatus.value = "";
    loading.value = false;
    visible.value = true;
    fetchedConfig.value = null;
    validatedUrl.value = "";
};

watch(remoteUrl, () => {
    fetchedConfig.value = null;
    validatedUrl.value = "";
});

const doCheck = async () => {
    fetchedConfig.value = null;
    logStatus.value = "";

    if (!remoteUrl.value) {
        Dialog.tipError(t("error.urlRequired"));
        return;
    }

    // Normalize URL
    let url = remoteUrl.value.trim();
    if (url.endsWith("/")) {
        url = url.substring(0, url.length - 1);
    }

    // Append /config if not present
    let requestUrl = url;
    if (!requestUrl.endsWith("/config")) {
        requestUrl = requestUrl + "/config";
    }

    loading.value = true;
    logStatus.value = t("common.checking");

    try {
        const response = await axios.post(requestUrl);
        const data = response.data;

        if (data.code !== 0) {
            throw new Error(data.msg || "Remote config request failed");
        }

        const configData = data.data;

        // Validate required fields
        if (!configData.name) throw new Error("Missing 'name' in remote config");
        if (!configData.version) throw new Error("Missing 'version' in remote config");
        if (!configData.title) throw new Error("Missing 'title' in remote config");

        // Check if exists
        const exists = await serverStore.getByNameVersion(configData.name, configData.version);
        if (exists) {
            Dialog.tipError(t("error.modelVersionExists"));
            return;
        }

        fetchedConfig.value = configData;
        validatedUrl.value = requestUrl.substring(0, requestUrl.length - "/config".length);

        logStatus.value = ""; // Clear status on success

    } catch (e: any) {
        console.error("ServerRemoteAddDialog.error", e);
        logStatus.value = e.message || t("error.networkError");
        Dialog.tipError(t("error.checkFailed"));
    } finally {
        loading.value = false;
    }
};

const doSubmit = async () => {
    if (!fetchedConfig.value) return;

    loading.value = true;

    try {
        const configData = fetchedConfig.value;
        const url = validatedUrl.value;

        // Add to store
        await serverStore.add({
            key: serverStore.generateServerKey({
                name: configData.name,
                version: configData.version,
            } as any),
            localPath: `${configData.name}_${configData.version}_` + StringUtil.random(16),
            name: configData.name,
            title: configData.title,
            version: configData.version,
            type: EnumServerType.REMOTE,
            autoStart: true,
            functions: configData.functions || [],
            remoteConfig: {
                url: url
            },
            settings: configData.settings || [],
            setting: {},
            config: configData
        } as ServerRecord);

        Dialog.tipSuccess(t("model.addSuccess"));
        visible.value = false;
        emit("update");
    } catch (e: any) {
        console.error("ServerRemoteAddDialog.addError", e);
        Dialog.tipError(e.message || "Failed to add server");
    } finally {
        loading.value = false;
    }
};

defineExpose({
    show,
});

const emit = defineEmits({
    update: () => true,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="30rem"
        :footer="false"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
    >
        <template #title>
            {{ $t("model.addRemote") }}
        </template>
        <div class="p-4">
            <div class="mb-4">
                <div class="mb-2 text-gray-700">{{ $t("model.remoteUrl") }}</div>
                <a-input
                    v-model="remoteUrl"
                    :placeholder="$t('model.remoteUrlPlaceholder')"
                    allow-clear
                    :disabled="loading"
                    @press-enter="!fetchedConfig ? doCheck() : doSubmit()"
                />
            </div>

            <div v-if="fetchedConfig" class="mb-4 bg-gray-50 p-3 rounded border border-gray-200">
                <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <div class="text-gray-500 text-right">名称</div>
                    <div class="font-medium text-gray-800">
                        {{ fetchedConfig.title }}
                        <div class="inline-block rounded-3xl bg-gray-100 px-3">v{{ fetchedConfig.version }}</div>
                    </div>
                </div>
            </div>

            <div v-if="logStatus" class="mb-4 text-sm text-gray-500">
                {{ logStatus }}
            </div>

            <div class="flex justify-end gap-2 mt-6">
                <a-button @click="visible = false" :disabled="loading">
                    {{ $t("common.cancel") }}
                </a-button>
                <a-button v-if="!fetchedConfig" type="primary" @click="doCheck" :loading="loading">
                    {{ "校验" }}
                </a-button>
                <a-button v-else type="primary" @click="doSubmit" :loading="loading">
                    {{ $t("common.confirm") }}
                </a-button>
            </div>
        </div>
    </a-modal>
</template>
