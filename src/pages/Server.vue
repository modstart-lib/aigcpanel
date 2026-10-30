<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import ServerActionInfo from "../components/Server/ServerActionInfo.vue";
import ServerActionLog from "../components/Server/ServerActionLog.vue";
import ServerPrepareStatus from "../components/Server/ServerPrepareStatus.vue";
import ServerActionMore from "../components/Server/ServerActionMore.vue";
import ServerOfflineAuthTag from "../components/Server/ServerOfflineAuthTag.vue";
import ServerActionSetting from "../components/Server/ServerActionSetting.vue";
import ServerActionStartStop from "../components/Server/ServerActionStartStop.vue";
import ServerActionComfyUIView from "../components/Server/ServerActionComfyUIView.vue";
import ServerAddDialog from "../components/Server/ServerAddDialog.vue";
import ServerStartTime from "../components/Server/ServerStartTime.vue";
import ServerStatus from "../components/Server/ServerStatus.vue";
import { AppConfig } from "../config";
import { t } from "../lang";
import { functionToLabels } from "../lib/aigcpanel";
import ModelSettingDialog from "../module/Model/ModelSettingDialog.vue";
import { useServerStore } from "../store/modules/server";
import { EnumServerType } from "../types/Server";

import ServerRemoteAddDialog from "../components/Server/ServerRemoteAddDialog.vue";

import ListerTop from "../components/common/ListerTop.vue";
import PageHeader from "../components/PageHeader.vue";
import { testActionSet, testActionUnset } from "../utils/test";


const addDialog = ref<InstanceType<typeof ServerAddDialog> | null>(null);
const remoteAddDialog = ref<InstanceType<typeof ServerRemoteAddDialog> | null>(
    null,
);

const modelSettingDialog = ref<InstanceType<typeof ModelSettingDialog> | null>(
    null,
);
const serverStore = useServerStore();
const helpShow = ref(false);

const doHelp = () => {
    window.$mapi.app.openExternal(AppConfig.helpUrl);
};

const doRefresh = async () => {
    await serverStore.refresh();
};

const typeName = (type: string) => {
    if (EnumServerType.LOCAL === type) {
        return t("model.localModel");
    } else if (EnumServerType.LOCAL_DIR === type) {
        return t("setting.localModelDir");
    } else if (EnumServerType.CLOUD === type) {
        return t("model.cloudModel");
    } else if (EnumServerType.REMOTE === type) {
        return t("model.remoteModel");
    }
};

onMounted(() => {
    testActionSet("page.ready", () => {});
    testActionSet("Server.modelSetting.show", () => {
        modelSettingDialog.value?.show();
    });
    // 添加本地模型（目录）测试流程：show → fill(configPath) → resolve → submit
    testActionSet("Server.addLocal.show", () => {
        addDialog.value?.show();
    });
    testActionSet("Server.addLocal.fill", async (params: any) => {
        const ok = await addDialog.value?.parseLocalDir(params.configPath);
        return { ok: !!ok };
    });
    testActionSet("Server.addLocal.resolve", () => {
        addDialog.value?.resolveManual();
    });
    testActionSet("Server.addLocal.submit", async () => {
        await addDialog.value?.doSubmit();
        return { ok: true };
    });
    // 模型列表与状态查询（供测试断言）
    testActionSet("Server.list", () => {
        return serverStore.records.map((r) => ({
            key: r.key,
            name: r.name,
            title: r.title,
            version: r.version,
            type: r.type,
            status: r.status,
            configType: r.config?.type,
            localPath: r.localPath,
            // spread 为普通数组，避免响应式代理数组经 CDP 序列化后变成对象
            functions: [...(r.functions || [])],
        }));
    });
    // 测试专用：清空全部本地模型记录（供 UI 导入测试前置清理，避免版本已存在）
    testActionSet("Server.clearAllForTest", async () => {
        serverStore.records.splice(0);
        await serverStore.sync();
        await serverStore.refresh();
        return { ok: true };
    });
    // comfyui 类型模型：启动 / 停止 / 查看（供测试与外部调用）
    testActionSet("Server.comfyui.start", async (params: any) => {
        const record = serverStore.records.find(
            (r) => r.name === (params?.name || "server-ComfyUI"),
        );
        if (!record) throw new Error("comfyui server not found");
        await serverStore.start(record);
        return { ok: true };
    });
    testActionSet("Server.comfyui.stop", async (params: any) => {
        const record = serverStore.records.find(
            (r) => r.name === (params?.name || "server-ComfyUI"),
        );
        if (!record) throw new Error("comfyui server not found");
        await serverStore.stop(record);
        return { ok: true };
    });
    // 权重按需下载：暂停 / 继续（供测试与外部调用）
    const findByName = (name?: string) => {
        const record = serverStore.records.find(
            (r) => r.name === (name || "server-IndexTTS25"),
        );
        if (!record) throw new Error(`server not found: ${name}`);
        return record;
    };
    testActionSet("Server.prepare.pause", async (params: any) => {
        await serverStore.pausePrepare(findByName(params?.name));
        return { ok: true };
    });
    testActionSet("Server.prepare.resume", async (params: any) => {
        await serverStore.prepare(findByName(params?.name));
        return { ok: true };
    });
    
});

onUnmounted(() => {
    testActionUnset([
        "page.ready",
        "Server.modelSetting.show",
        "Server.comfyui.start",
        "Server.comfyui.stop",
        "Server.prepare.pause",
        "Server.prepare.resume",
        "Server.addLocal.show",
        "Server.addLocal.fill",
        "Server.addLocal.resolve",
        "Server.addLocal.submit",
        "Server.list",
        "Server.clearAllForTest",
    ]);
    
});
</script>

<template>
    <div
        class="pb-device-container bg-white p-6 min-h-full relative select-none"
    >
        <PageHeader title="AI模型" />
        <ListerTop :total="serverStore.records.length" @refresh="doRefresh">
            <template #actions>
                <a-button
                    v-if="serverStore.records.length > 0"
                    @click="addDialog?.show()"
                >
                    <template #icon>
                        <icon-plus />
                    </template>
                    {{ $t("model.addLocal") }}
                </a-button>
                
                <a-dropdown trigger="click">
                    <a-button>
                        <template #icon>
                            <icon-apps />
                        </template>
                        {{ $t("model.otherModel") }}
                    </a-button>
                    <template #content>
                        <a-doption @click="remoteAddDialog?.show()">
                            <template #icon>
                                <icon-cloud />
                            </template>
                            {{ $t("model.remoteModel") }}
                        </a-doption>
                        
                    </template>
                </a-dropdown>
                <a-button @click="modelSettingDialog?.show()">
                    <template #icon>
                        <icon-command />
                    </template>
                    {{ $t("setting.llm") }}
                </a-button>
            </template>
        </ListerTop>
        <div>
            <div v-if="!serverStore.records.length" class="py-20">
                <div class="text-center">
                    <img
                        class="h-32 m-auto opacity-50"
                        src="./../assets/image/server-empty.svg"
                    />
                </div>
                <div class="mt-5 text-center text-gray-400">
                    <div>{{ $t("empty.noModelAdd") }}</div>
                </div>
                <div class="mt-5 text-center">
                    <a-button class="ml-1" @click="addDialog?.show()">
                        <template #icon>
                            <icon-plus />
                        </template>
                        {{ $t("model.addLocal") }}
                    </a-button>
                    <a-dropdown trigger="click">
                        <a-button class="ml-1">
                            <template #icon>
                                <icon-apps />
                            </template>
                            {{ $t("model.otherModel") }}
                        </a-button>
                        <template #content>
                            <a-doption @click="remoteAddDialog?.show()">
                                {{ $t("model.remoteModel") }}
                            </a-doption>
                            
                        </template>
                    </a-dropdown>
                    <a-button class="mx-1" @click="helpShow = true">
                        <template #icon>
                            <icon-book class="mr-1" />
                        </template>
                        {{ $t("help.howToAddModel") }}
                    </a-button>
                </div>
                <div v-if="helpShow" class="pt-5 text-center">
                    <div
                        class="inline-block bg-gray-100 text-left rounded-lg p-6 leading-8"
                    >
                        <div>① {{ $t("model.marketTip") }}</div>
                        <div>② {{ $t("model.unzipTip") }}</div>
                        <div class="pt-3">
                            {{ $t("msg.moreContent") }}
                            <a
                                href="javascript:;"
                                class="text-link"
                                @click="doHelp"
                            >
                                <icon-book />
                                {{ $t("common.onlineDocs") }}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else class="flex flex-wrap -mx-2">
                <div
                    v-for="record in serverStore.records"
                    :key="record.key"
                    class="w-full lg:w-1/2 2xl:w-1/3 p-2 mb-1"
                >
                    <div class="rounded-xl shadow border p-4">
                        <div class="flex items-center">
                            <div class="flex-grow">
                                <div class="inline-block mr-4">
                                    <a-tooltip
                                        :content="
                                            typeName(record.type as string)
                                        "
                                        mini
                                    >
                                        <div class="inline-block">
                                            <icon-cloud
                                                v-if="
                                                    record.type ===
                                                    EnumServerType.REMOTE
                                                "
                                                class="text-lg"
                                            ></icon-cloud>
                                            <icon-apps
                                                v-else-if="
                                                    record.config?.type ===
                                                    'comfyui'
                                                "
                                                class="text-lg text-blue-600"
                                            ></icon-apps>
                                            <i-mdi-folder-outline v-else />
                                        </div>
                                    </a-tooltip>
                                </div>
                                <div class="inline-block mr-4">
                                    {{ record.title }}
                                    <div
                                        v-if="
                                            record.type !== EnumServerType.CLOUD
                                        "
                                        class="inline-block rounded-3xl bg-gray-100 px-3"
                                    >
                                        v{{ record.version }}
                                    </div>
                                    <ServerOfflineAuthTag :record="record" />
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <a-tooltip
                                    v-if="record.config?.mode?.type === 'watch'"
                                    :content="$t('model.accelerationOn')"
                                >
                                    <icon-thunderbolt />
                                </a-tooltip>
                                <ServerStatus
                                    :status="record.status"
                                    :auto-start="record.autoStart!"
                                    :runtime="record.runtime"
                                />
                            </div>
                        </div>
                        <div class="h-12 pt-4">
                            <div
                                class="text-gray-400 text-sm overflow-hidden whitespace-nowrap text-ellipsis"
                            >
                                <a-tag
                                    v-for="label in functionToLabels(
                                        record.functions,
                                    )"
                                    :key="label"
                                    class="mr-1 rounded-lg"
                                >
                                    {{ label }}
                                </a-tag>
                            </div>
                        </div>
                        <div class="pt-4 flex items-center">
                            <div class="flex-grow flex items-center min-w-0">
                                <!-- 普通模型：启动/停止按钮保持原位置（最左） -->
                                <ServerActionStartStop
                                    v-if="
                                        !record.config?.prepare &&
                                        !record.autoStart &&
                                        (record.type ===
                                            EnumServerType.LOCAL_DIR ||
                                            record.config?.type === 'comfyui')
                                    "
                                    :record="record"
                                />
                                <ServerActionComfyUIView :record="record" />
                                <ServerActionLog :record="record" />
                                <ServerActionInfo :record="record" />
                                <!-- 权重按需下载：状态描述在左，下载/暂停/重试按钮紧随其右 -->
                                <ServerPrepareStatus :record="record" />
                                <ServerActionStartStop
                                    v-if="
                                        !!record.config?.prepare &&
                                        record.runtime?.prepareReady === false
                                    "
                                    :record="record"
                                />
                                <ServerActionSetting
                                    v-if="
                                        record.settings &&
                                        Object.keys(record.settings).length > 0
                                    "
                                    :record="record"
                                />
                            </div>
                            <div class="flex items-center">
                                <ServerStartTime :record="record" />
                                <ServerActionMore
                                    :record="record"
                                    @update="doRefresh"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <ServerAddDialog ref="addDialog" @update="doRefresh" />
    <ServerRemoteAddDialog ref="remoteAddDialog" @update="doRefresh" />
    
    <ModelSettingDialog ref="modelSettingDialog" />
    
</template>

<style scoped></style>
