<script setup lang="ts">
import {ref} from "vue";
import ServerActionDelete from "../components/Server/ServerActionDelete.vue";
import ServerActionInfo from "../components/Server/ServerActionInfo.vue";
import ServerActionLog from "../components/Server/ServerActionLog.vue";
import ServerActionSetting from "../components/Server/ServerActionSetting.vue";
import ServerActionStartStop from "../components/Server/ServerActionStartStop.vue";
import ServerAddDialog from "../components/Server/ServerAddDialog.vue";
import ServerStartTime from "../components/Server/ServerStartTime.vue";
import ServerStatus from "../components/Server/ServerStatus.vue";
import {AppConfig} from "../config";
import {t} from "../lang";
import {functionToLabels} from "../lib/aigcpanel";
import ModelSettingDialog from "../module/Model/ModelSettingDialog.vue";
import ServerRemoteAddDialog from "../components/Server/ServerRemoteAddDialog.vue";
import {useServerStore} from "../store/modules/server";
import {EnumServerType} from "../types/Server";

const addDialog = ref<InstanceType<typeof ServerAddDialog> | null>(null);
const remoteAddDialog = ref<InstanceType<typeof ServerRemoteAddDialog> | null>(null);
const modelSettingDialog = ref<InstanceType<typeof ModelSettingDialog> | null>(null);
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
</script>

<template>
    <div class="pb-device-container bg-white p-6 min-h-full relative select-none">
        <div class="mb-4 flex items-center">
            <div class="text-3xl font-bold flex-grow">
                {{ $t("model.model") }}
            </div>
            <div class="flex items-center">
                <a-button class="ml-1" @click="modelSettingDialog?.show()">
                    <template #icon>
                        <icon-command/>
                    </template>
                    {{ $t("setting.llm") }}
                </a-button>
                <a-button v-if="serverStore.records.length > 0" class="ml-1" @click="remoteAddDialog?.show()">
                    <template #icon>
                        <icon-cloud/>
                    </template>
                    {{ $t("model.addRemote") }}
                </a-button>
                <a-button v-if="serverStore.records.length > 0" class="ml-1" @click="addDialog?.show()">
                    <template #icon>
                        <icon-plus/>
                    </template>
                    {{ $t("model.addLocal") }}
                </a-button>
            </div>
        </div>
        <div>
            <div v-if="!serverStore.records.length" class="py-20">
                <div class="text-center">
                    <img class="h-32 m-auto opacity-50" src="./../assets/image/server-empty.svg"/>
                </div>
                <div class="mt-5 text-center text-gray-400">
                    <div>{{ $t("empty.noModelAdd") }}</div>
                </div>
                <div class="mt-5 text-center">
                    <a-button class="ml-1" @click="addDialog?.show()">
                        <template #icon>
                            <icon-plus/>
                        </template>
                        {{ $t("model.addLocal") }}
                    </a-button>
                    <a-button class="ml-1" @click="remoteAddDialog?.show()">
                        <template #icon>
                            <icon-cloud/>
                        </template>
                        {{ $t("model.addRemote") }}
                    </a-button>
                    <a-button v-if="0" class="ml-1">
                        <template #icon>
                            <icon-apps/>
                        </template>
                        {{ $t("model.addCloud") }}
                    </a-button>
                    <a-button class="mx-1" @click="helpShow = true">
                        <template #icon>
                            <icon-book class="mr-1"/>
                        </template>
                        {{ $t("help.howToAddModel") }}
                    </a-button>
                </div>
                <div v-if="helpShow" class="pt-5 text-center">
                    <div class="inline-block bg-gray-100 text-left rounded-lg p-6 leading-8">
                        <div>① {{ $t("model.marketTip") }}</div>
                        <div>② {{ $t("model.unzipTip") }}</div>
                        <div class="pt-3">
                            {{ $t("msg.moreContent") }}
                            <a href="javascript:;" class="text-link" @click="doHelp">
                                <icon-book/>
                                {{ $t("common.onlineDocs") }}
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else class="flex flex-wrap -mx-2">
                <div v-for="record in serverStore.records" class="w-full lg:w-1/2 2xl:w-1/3 p-2 mb-1">
                    <div class="rounded-xl shadow border p-4">
                        <div class="flex items-center">
                            <div class="flex-grow">
                                <div class="inline-block mr-4">
                                    <a-tooltip :content="typeName(record.type as string)" mini>
                                        <div class="inline-block">
                                            <icon-cloud v-if="record.type===EnumServerType.REMOTE" class="text-lg"></icon-cloud>
                                            <i v-else class="iconfont icon-folder"></i>
                                        </div>
                                    </a-tooltip>
                                </div>
                                <div class="inline-block mr-4">
                                    {{ record.title }}
                                    <div class="inline-block rounded-3xl bg-gray-100 px-3">v{{ record.version }}</div>
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <a-tooltip v-if="record.config?.mode?.type==='watch'"
                                           :content="$t('model.accelerationOn')">
                                    <icon-thunderbolt/>
                                </a-tooltip>
                                <ServerStatus
                                    :status="record.status"
                                    :auto-start="record.autoStart!"
                                    :runtime="record.runtime"
                                />
                            </div>
                        </div>
                        <div class="h-12 pt-4">
                            <div class="text-gray-400 text-sm">
                                <a-tag v-for="label in functionToLabels(record.functions)"
                                       class="mr-1 rounded-lg">
                                    {{ label }}
                                </a-tag>
                            </div>
                        </div>
                        <div class="pt-4 flex items-center">
                            <div class="flex-grow">
                                <ServerActionStartStop
                                    v-if="!record.autoStart && record.type === EnumServerType.LOCAL_DIR"
                                    :record="record"
                                />
                                <ServerActionLog :record="record"/>
                                <ServerActionDelete :record="record" @update="doRefresh"/>
                                <ServerActionInfo :record="record"/>
                                <ServerActionSetting
                                    v-if="record.settings && Object.keys(record.settings).length > 0"
                                    :record="record"
                                />
                            </div>
                            <div>
                                <ServerStartTime :record="record"/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <ServerAddDialog ref="addDialog" @update="doRefresh" />
    <ServerRemoteAddDialog ref="remoteAddDialog" @update="doRefresh"/>
    <ModelSettingDialog ref="modelSettingDialog" />
</template>

<style scoped></style>
