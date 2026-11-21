<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import InputInlineEditor from "../../components/common/InputInlineEditor.vue";
import VideoPlayer from "../../components/common/VideoPlayer.vue";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import { FileUtil } from "../../lib/file";
import { doSaveFile } from "../../components/common/util";
import {
    VideoTemplateRecord,
    VideoTemplateService,
} from "../../service/VideoTemplateService";
import VideoInfo from "../Apps/common/VideoInfo.vue";
import VideoTemplateCloudDialog from "./components/VideoTemplateCloudDialog.vue";
import VideoTemplateEditDialog from "./components/VideoTemplateEditDialog.vue";
import ListerTop from "../../components/common/ListerTop.vue";
import MEmpty from "../../components/common/MEmpty.vue";
import MLoading from "../../components/common/MLoading.vue";
import PageHeader from "../../components/PageHeader.vue";
import { testActionSet, testActionUnset } from "../../utils/test";

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

onUnmounted(() => {
    
});

const doDelete = async (record: VideoTemplateRecord) => {
    await Dialog.confirm(t("common.deleteConfirm"));
    await VideoTemplateService.delete(record);
    await doRefresh();
};

const onChangeTitle = async (record: VideoTemplateRecord, value: string) => {
    await VideoTemplateService.update(record.id!, { name: value });
    await doRefresh();
};

// 导出形象视频，默认文件名为形象标题
const doExportVideo = async (record: VideoTemplateRecord) => {
    if (!record.video) {
        return;
    }
    const ext = FileUtil.getExt(record.video) || "mp4";
    await doSaveFile(
        record.video,
        window.$mapi.file.textToName(record.name, ext),
    );
};

const onUpdate = async () => {
    await doRefresh();
};
</script>

<template>
    <div class="p-5">
        <PageHeader :title="$t('avatar.avatar')" :desc="$t('avatar.manage')" />
        <ListerTop
            :loading="loading"
            :total="records.length"
            @refresh="doRefresh"
        >
            <template #actions>
                <a-button @click="cloudDialog?.show()">
                    <template #icon>
                        <i-mdi-cloud-download />
                    </template>
                    {{ $t("model.cloudAvatar") }}
                </a-button>
                <a-button @click="editDialog?.add()">
                    <template #icon>
                        <i-mdi-plus />
                    </template>
                    {{ $t("common.add") }}
                </a-button>
            </template>
        </ListerTop>
        <div>
            <m-empty v-if="!records.length && !loading" />
            <m-loading v-else-if="!records.length && loading" page />
            <div class="flex flex-wrap -mx-2">
                <div
                    v-for="r in records"
                    :key="r.id"
                    class="w-1/3 flex-shrink-0 p-2"
                >
                    <div class="rounded-xl shadow border p-4 hover:shadow-lg">
                        <div class="flex mb-3">
                            <div class="flex-grow w-0 mr-2">
                                <div
                                    class="inline-flex max-w-full items-center bg-blue-100 rounded-full px-2 leading-8 h-8"
                                >
                                    <div
                                        class="truncate overflow-hidden flex-grow cursor-pointer"
                                    >
                                        {{ r.name }}
                                    </div>
                                    <InputInlineEditor
                                        :value="r.name"
                                        @change="onChangeTitle(r, $event)"
                                    >
                                        <a
                                            class="ml-1 text-gray-400 block"
                                            href="javascript:;"
                                        >
                                            <i-mdi-pencil />
                                        </a>
                                    </InputInlineEditor>
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <a-tooltip
                                    :content="$t('common.exportVideo')"
                                    mini
                                >
                                    <a-button @click="doExportVideo(r)">
                                        <template #icon>
                                            <i-mdi-download />
                                        </template>
                                    </a-button>
                                </a-tooltip>
                                <a-button @click="doDelete(r)">
                                    <template #icon>
                                        <i-mdi-delete />
                                    </template>
                                </a-button>
                            </div>
                        </div>
                        <div class="mb-3">
                            <div class="h-48 bg-black p-2 rounded-lg">
                                <VideoPlayer :url="r.video" />
                            </div>
                        </div>
                        <div class="flex gap-1 flex-wrap">
                            <VideoInfo
                                :data="r.info"
                                :label="false"
                                :icon="false"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <VideoTemplateEditDialog @update="onUpdate" ref="editDialog" />
    <VideoTemplateCloudDialog @update="onUpdate" ref="cloudDialog" />
</template>
