<script setup lang="ts">
import {onMounted, ref} from "vue";
import InputInlineEditor from "../../components/common/InputInlineEditor.vue";
import VideoPlayer from "../../components/common/VideoPlayer.vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {VideoTemplateRecord, VideoTemplateService} from "../../service/VideoTemplateService";
import VideoInfo from "../Apps/common/VideoInfo.vue";
import VideoTemplateCloudDialog from "./components/VideoTemplateCloudDialog.vue";
import VideoTemplateEditDialog from "./components/VideoTemplateEditDialog.vue";

const editDialog = ref<InstanceType<typeof VideoTemplateEditDialog>>();
const cloudDialog = ref<InstanceType<typeof VideoTemplateCloudDialog>>();
const records = ref<VideoTemplateRecord[]>([]);
const loading = ref(true);

const doRefresh = async () => {
    loading.value = true;
    records.value = await VideoTemplateService.list();
    loading.value = false;
};

onMounted(async () => {
    await doRefresh();
});

const doDelete = async (record: VideoTemplateRecord) => {
    await Dialog.confirm(t("common.deleteConfirm"));
    await VideoTemplateService.delete(record);
    await doRefresh();
};

const onChangeTitle = async (record: VideoTemplateRecord, value: string) => {
    await VideoTemplateService.update(record.id!, {name: value});
    await doRefresh();
};

const onUpdate = async () => {
    await doRefresh();
};
</script>

<template>
    <div class="p-5">
        <div class="mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">{{ $t("avatar.avatar") }}</div>
                <div class="text-gray-400 ml-3">{{ $t("avatar.manage") }}</div>
            </div>
            <div class="flex items-center">
                <a-button @click="cloudDialog?.show()" class="ml-2">
                    <template #icon>
                        <icon-cloud />
                    </template>
                    {{ $t("model.cloudAvatar") }}
                </a-button>
                <a-button @click="editDialog?.add()" class="ml-2">
                    <template #icon>
                        <icon-plus />
                    </template>
                    {{ $t("common.add") }}
                </a-button>
            </div>
        </div>
        <div>
            <m-empty v-if="!records.length && !loading" />
            <m-loading v-else-if="!records.length && loading" page />
            <div class="flex flex-wrap -mx-2">
                <div v-for="r in records" :key="r.id" class="w-1/3 flex-shrink-0 p-2">
                    <div class="rounded-xl shadow border p-4 hover:shadow-lg">
                        <div class="flex mb-3">
                            <div class="flex-grow w-0 mr-2">
                                <div
                                    class="inline-flex max-w-full items-center bg-blue-100 rounded-full px-2 leading-8 h-8"
                                >
                                    <div class="truncate overflow-hidden flex-grow cursor-pointer">
                                        {{ r.name }}
                                    </div>
                                    <InputInlineEditor :value="r.name" @change="onChangeTitle(r, $event)">
                                        <a class="ml-1 text-gray-400" href="javascript:;">
                                            <icon-pen />
                                        </a>
                                    </InputInlineEditor>
                                </div>
                            </div>
                            <div>
                                <a-button @click="doDelete(r)">
                                    <template #icon>
                                        <icon-delete />
                                    </template>
                                </a-button>
                            </div>
                        </div>
                        <div class="mb-3">
                            <div class="h-48 bg-black p-2 rounded-lg">
                                <VideoPlayer :url="'file://' + r.video" />
                            </div>
                        </div>
                        <div class="flex gap-1">
                            <VideoInfo :data="r.info" :label="false" :icon="false" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <VideoTemplateEditDialog @update="onUpdate" ref="editDialog" />
    <VideoTemplateCloudDialog @update="onUpdate" ref="cloudDialog" />
</template>
