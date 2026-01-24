<script setup lang="ts">
import {ref} from "vue";
import {buildServerContent, functionToLabels} from "../../lib/aigcpanel";
import {useServerStore} from "../../store/modules/server";
import {EnumServerType, ServerRecord} from "../../types/Server";

const serverStore = useServerStore();
const props = defineProps<{
    record: ServerRecord;
}>();

const httpUrl = ref("");
const content = ref("");
const visible = ref(false);

const show = async () => {
    visible.value = true;
    const serverInfo = await serverStore.serverInfo(props.record);
    const res = await $mapi.server.config(serverInfo);
    httpUrl.value = res.data?.httpUrl || "";
    content.value = buildServerContent(res.data);
};

const doOpenHttpUrl = () => {
    if (httpUrl.value) {
        $mapi.app.openExternal(httpUrl.value);
    }
};

const doOpenDir = (path: string) => {
    $mapi.app.openPath(path);
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="40rem" :footer="false" title-align="start">
        <template #title>
            {{ $t("model.info") }}
        </template>
        <div>
            <div class="border rounded-lg p-3">
                <div class="flex mb-4">
                    <div class="w-20">{{ $t("model.model") }}</div>
                    <div class="flex flex-wrap items-center">
                        <div class="mr-2 mb-1">{{ props.record.title }}</div>
                        <div class="mr-2 text-sm bg-gray-100 px-2 leading-6 inline-block rounded-lg mb-1">
                            v{{ props.record.version }}
                        </div>
                        <div
                            v-if="record.type === EnumServerType.LOCAL_DIR"
                            class="mr-2 text-xs bg-gray-100 px-2 leading-6 inline-block rounded-lg mb-1"
                        >
                            {{ props.record.name }}
                        </div>
                    </div>
                </div>
                <div class="flex mb-4">
                    <div class="w-20">{{ $t("common.type") }}</div>
                    <div>
                        <div>
                            <div v-if="record.type === EnumServerType.LOCAL">
                                <i class="iconfont icon-desktop mr-1"></i>
                                {{ $t("model.localModel") }}
                            </div>
                            <div v-else-if="record.type === EnumServerType.LOCAL_DIR">
                                <i class="iconfont icon-folder mr-1"></i>
                                {{ $t("setting.localModelDir") }}
                            </div>
                            <div v-else-if="record.type === EnumServerType.CLOUD">
                                <i class="iconfont icon-network mr-1"></i>
                                {{ $t("model.cloudModel") }}
                            </div>
                        </div>
                        <div
                            v-if="record.type === EnumServerType.LOCAL_DIR"
                            class="rounded-lg py-1 px-1 text-xs bg-gray-100 cursor-pointer"
                            @click="doOpenDir(props.record.localPath!)"
                        >
                            {{ props.record.localPath }}
                        </div>
                    </div>
                </div>
                <div class="flex mb-4">
                    <div class="w-20">{{ $t("common.feature") }}</div>
                    <div>
                        <a-tag v-for="label in functionToLabels(record.functions)" class="mr-1 rounded-lg">
                            {{ label }}
                        </a-tag>
                    </div>
                </div>
                <div class="flex mb-4" v-if="httpUrl">
                    <div class="w-20">{{ $t("common.service") }}</div>
                    <div class="">
                        <div class="font-mono">
                            <div class="inline-block mr-2">
                                {{ httpUrl }}
                            </div>
                            <a-button size="mini" @click="doOpenHttpUrl">
                                <template #icon>
                                    <icon-link />
                                </template>
                            </a-button>
                        </div>
                    </div>
                </div>
                <div class="flex mb-4" v-if="content">
                    <div class="w-20">{{ $t("common.description") }}</div>
                    <div class="flex-grow">
                        <div class="w-full max-h-32 p-3 overflow-auto text-sm bg-gray-100 leading-6 rounded-lg">
                            <div v-html="content"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
