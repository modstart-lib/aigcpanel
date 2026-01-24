<script setup lang="ts">
import {computed, ref} from "vue";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {functionToLabels} from "../../lib/aigcpanel";
import {EnumServerType, ServerRecord} from "../../types/Server";
import {useServerStore} from "../../store/modules/server";
import {VersionUtil} from "../../lib/util";
import {AppConfig} from "../../config";
import ServerAddResolvePanel from "./ServerAddResolvePanel.vue";
import {isDev} from "../../lib/env";

const resolvePanel = ref<InstanceType<typeof ServerAddResolvePanel> | null>(null);

const serverStore = useServerStore();
const visible = ref(false);
const loading = ref(false);
const modelInfo = ref({
    type: EnumServerType.LOCAL as EnumServerType,
    name: "",
    version: "",
    serverRequire: "",
    title: "",
    description: "",
    deviceDescription: "",
    path: "",
    platformName: "",
    platformArch: "",
    entry: "",
    functions: [],
    settings: [],
    setting: {},
    isSupport: false,
    config: {} as Record<string, any>,
});
const isImporting = ref(false);
const logStatus = ref("");

const show = () => {
    emptyModelInfo();
    visible.value = true;
};

const platformInfo = computed(() => {
    const platformNameMap = {
        win: "Windows",
        osx: "macOS",
        linux: "Linux",
    };
    const platformName = platformNameMap[modelInfo.value.platformName] || modelInfo.value.platformName;
    return `${platformName} ${modelInfo.value.platformArch}`;
});
const functionLabels = computed(() => {
    return functionToLabels(modelInfo.value.functions);
});

const emptyModelInfo = () => {
    modelInfo.value.type = EnumServerType.LOCAL;
    modelInfo.value.name = "";
    modelInfo.value.version = "";
    modelInfo.value.title = "";
    modelInfo.value.description = "";
    modelInfo.value.serverRequire = "";
    modelInfo.value.deviceDescription = "";
    modelInfo.value.path = "";
    modelInfo.value.platformName = "";
    modelInfo.value.platformArch = "";
    modelInfo.value.entry = "";
    modelInfo.value.functions = [];
    modelInfo.value.settings = [];
    modelInfo.value.setting = {};
    modelInfo.value.isSupport = false;
    modelInfo.value.config = {};
    resolvePanel.value?.reset();
};

const doSubmitLocalDir = async () => {
    await serverStore.add({
        key: serverStore.generateServerKey({
            name: modelInfo.value.name,
            version: modelInfo.value.version,
        } as any),
        name: modelInfo.value.name,
        title: modelInfo.value.title,
        version: modelInfo.value.version,
        type: modelInfo.value.type,
        autoStart: modelInfo.value.entry === "__EasyServer__",
        functions: modelInfo.value.functions,
        localPath: modelInfo.value.path,
        settings: modelInfo.value.settings,
        setting: modelInfo.value.setting,
        config: modelInfo.value.config,
    } as ServerRecord);
};

const doSubmit = async () => {
    if (!modelInfo.value.path) {
        return;
    }
    const target = await $mapi.file.fullPath(`model/${modelInfo.value.name}-${modelInfo.value.version}`);
    if (await $mapi.file.exists(target)) {
        Dialog.tipError(t("error.modelVersionExists"));
        return;
    }
    const exists = await serverStore.getByNameVersion(modelInfo.value.name, modelInfo.value.version);
    if (exists) {
        Dialog.tipError(t("error.modelVersionExists"));
        return;
    }
    if ($mapi.app.platformName() !== modelInfo.value.platformName && !isDev) {
        Dialog.tipError(t("error.modelPlatformMismatch"));
        return;
    }
    if ($mapi.app.platformArch() !== modelInfo.value.platformArch && !isDev) {
        Dialog.tipError(t("error.modelArchMismatch"));
        return;
    }
    if (!VersionUtil.match(AppConfig.version, modelInfo.value.serverRequire)) {
        Dialog.tipError(t("error.softwareVersionMismatch"));
        return;
    }
    isImporting.value = true;
    if (modelInfo.value.type === EnumServerType.LOCAL_DIR) {
        await doSubmitLocalDir();
    } else {
        Dialog.tipError(t("error.modelTypeInvalid"));
        return;
    }
    Dialog.tipSuccess(t("model.addSuccess"));
    visible.value = false;
    isImporting.value = false;
    emit("update");
};

const doSelectLocalDir = async () => {
    const configPath = await $mapi.file.openFile({
        filters: [{name: "config.json", extensions: ["json"]}],
    });
    if (!configPath) {
        return;
    }
    if (!/^[a-zA-Z0-9\/:\-\\._]+$/.test(configPath)) {
        Dialog.tipError(t("error.modelPathInvalid"));
        return;
    }
    emptyModelInfo();
    loading.value = true;
    try {
        const content = await $mapi.file.read(configPath, {
            isDataPath: false,
        });
        const serverPath = configPath.replace(/[\/\\]config.json$/, "");
        const json = JSON.parse(content);
        modelInfo.value.type = EnumServerType.LOCAL_DIR;
        modelInfo.value.name = json.name || "";
        modelInfo.value.version = json.version || "";
        modelInfo.value.serverRequire = json.serverRequire || "*";
        modelInfo.value.deviceDescription = json.deviceDescription || "";
        modelInfo.value.title = json.title || "";
        modelInfo.value.description = json.description || "";
        modelInfo.value.path = serverPath;
        modelInfo.value.platformName = json.platformName || "";
        modelInfo.value.platformArch = json.platformArch || "";
        modelInfo.value.entry = json.entry || "";
        modelInfo.value.functions = json.functions || [];
        modelInfo.value.settings = json.settings || {};
        modelInfo.value.setting = json.setting || {};
        modelInfo.value.config = json;
        modelInfo.value.isSupport = await $mapi.server.isSupport({
            localPath: serverPath,
            name: modelInfo.value.name,
        } as any);
        if (modelInfo.value.isSupport) {
            logStatus.value = "";
        } else {
            logStatus.value = t("model.notSupported");
            if (modelInfo.value.platformName !== $mapi.app.platformName()) {
                logStatus.value += `(${t("error.platformMismatch")})`;
            }
            if (modelInfo.value.platformArch !== $mapi.app.platformArch()) {
                logStatus.value += `(${t("error.archMismatch")})`;
            }
        }
    } catch (e) {
        console.log("ServerImportLocalDialog.doSelectLocalDir.error", e);
        Dialog.tipError(t("error.modelDirIdentifyFailed"));
    }
    loading.value = false;
};

const doSelectCloud = async () => {
    Dialog.tipError(t("请升级Pro版使用"));
};
defineExpose({
    show,
    doSelectCloud,
});

const emit = defineEmits({
    update: () => true,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="40rem"
        :footer="false"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
    >
        <template #title>
            {{ $t("model.addLocal") }}
        </template>
        <div>
            <div class="select-none" style="max-height: 70vh">
                <div v-if="!modelInfo.name">
                    <div class="px-3">
                        <div>
                            <img class="w-48 h-48 object-contain m-auto" src="./../../assets/image/server-folder.svg"/>
                        </div>
                        <div class="flex gap-4">
                            <a-button @click="doSelectLocalDir" class="block w-full" :loading="loading">
                                <template #icon>
                                    <icon-folder/>
                                </template>
                                {{ t("model.selectLocal") }}
                                config.json
                            </a-button>
                            <a
                                href="https://aigcpanel.com/zh/asset"
                                target="_blank"
                                class="arco-btn arco-btn-secondary arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal block w-full text-center py-1"
                            >
                                <icon-cloud/>
                                {{ t("model.download") }}
                            </a>
                        </div>
                        <div class="mt-2">
                            <div class="text-sm bg-gray-100 p-5 rounded-lg text-gray-500 leading-6">
                                <div>
                                    {{ $t("model.runInLocalDesc") }}
                                </div>
                                <div>
                                    {{ "① " + $t("model.marketTip") }}
                                </div>
                                <div>
                                    {{ "② " + $t("model.unzipTip") }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else>
                    <div class="border rounded-lg py-4 leading-10">
                        <div class="flex">
                            <div class="pr-3 text-right w-20">{{ t("common.name") }}</div>
                            <div class="flex flex-wrap items-center">
                                <div class="mr-2 mb-1">{{ modelInfo.title }}</div>
                                <div class="mr-2 text-sm bg-gray-100 px-2 leading-6 inline-block rounded-lg mb-1">
                                    v{{ modelInfo.version }}
                                </div>
                                <div class="mr-2 text-xs bg-gray-100 px-2 leading-6 inline-block rounded-lg mb-1">
                                    {{ modelInfo.name }}
                                </div>
                            </div>
                        </div>
                        <div class="flex">
                            <div class="pr-3 text-right w-20 flex-shrink-0">{{ t("common.description") }}</div>
                            <div>{{ modelInfo.description }}</div>
                        </div>
                        <div class="flex">
                            <div class="pr-3 text-right w-20 flex-shrink-0">{{ $t("common.adapt") }}</div>
                            <div>{{ platformInfo }}</div>
                        </div>
                        <div class="flex">
                            <div class="pr-3 text-right w-20 flex-shrink-0">{{ $t("common.feature") }}</div>
                            <div>
                                <a-tag v-for="label in functionLabels" class="mr-1">
                                    {{ label }}
                                </a-tag>
                            </div>
                        </div>
                        <div class="flex">
                            <div class="pr-3 text-right w-20 flex-shrink-0">{{ t("model.hardwareReq") }}</div>
                            <div>{{ modelInfo.deviceDescription }}</div>
                        </div>
                        <div class="flex">
                            <div class="pr-3 text-right w-20 flex-shrink-0">{{ t("model.versionReq") }}</div>
                            <div>{{ modelInfo.serverRequire === "*" ? t("common.none") : modelInfo.serverRequire }}</div>
                        </div>
                    </div>
                    <div>
                        <ServerAddResolvePanel ref="resolvePanel" :root="modelInfo.path"/>
                    </div>
                    <div class="pt-4 flex items-center">
                        <div>
                            <a-button
                                class="mr-2"
                                type="primary"
                                :disabled="(!modelInfo.isSupport||!resolvePanel?.isSuccess().value) as boolean"
                                :loading="isImporting"
                                @click="doSubmit"
                            >
                                <template #icon>
                                    <icon-check/>
                                </template>
                                {{ $t("common.submitConfirm") }}
                            </a-button>
                            <a-button class="mr-2" v-if="!isImporting" @click="emptyModelInfo" :loading="loading">
                                <template #icon>
                                    <icon-redo/>
                                </template>
                                {{ $t("common.reselect") }}
                            </a-button>
                        </div>
                        <div class="flex-grow pl-3 text-sm truncate text-red-600">
                            {{ logStatus }}
                        </div>
                    </div>
                </div>
                <div class="h-5"></div>
            </div>
        </div>
    </a-modal>
</template>
