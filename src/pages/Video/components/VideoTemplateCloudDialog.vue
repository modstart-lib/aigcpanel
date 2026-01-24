<script setup lang="ts">
import {computed, ref} from "vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";
import {ffmpegVideoNormal} from "../../../lib/ffmpeg";
import {ffprobeVideoInfo} from "../../../lib/ffprobe";
import {VideoTemplateRecord, VideoTemplateService} from "../../../service/VideoTemplateService";
import {useServerCloudStore, VideoTemplateCloudRecord} from "../../../store/modules/serverCloud";

const serverCloudStore = useServerCloudStore();

const visible = ref(false);
const loading = ref(true);
const records = ref<VideoTemplateCloudRecord[]>([]);
const selectedTags = ref<string[]>([]);

const allTags = computed(() => {
    const tags = new Set<string>();
    records.value.forEach(r => r.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags);
});

const filteredRecords = computed(() => {
    if (selectedTags.value.length === 0) return records.value;
    return records.value.filter(r => selectedTags.value.some(tag => r.tags.includes(tag)));
});

const toggleTag = (tag: string) => {
    const index = selectedTags.value.indexOf(tag);
    if (index > -1) {
        selectedTags.value.splice(index, 1);
    } else {
        selectedTags.value.push(tag);
    }
};

const doLoad = async () => {
    loading.value = true;
    await serverCloudStore.listVideoTemplates();
    records.value = serverCloudStore.videoTemplateRecords;
    loading.value = false;
};

const show = () => {
    visible.value = true;
    if (loading.value) {
        doLoad();
    }
};

const doDownload = async (record: VideoTemplateCloudRecord) => {
    try {
        Dialog.loadingOn(t("common.downloadingWait"));
        const videoTemplate = await serverCloudStore.getVideoTemplate(record.id);
        const videoPath = await $mapi.file.download(videoTemplate.video);
        const normalPath = await ffmpegVideoNormal(videoPath, {
            durationMax: 120,
        });
        const videoInfo = await ffprobeVideoInfo(normalPath);
        const videoPathFull = await window.$mapi.file.hubSave(normalPath);
        await VideoTemplateService.insert({
            name: record.title,
            video: videoPathFull,
            info: videoInfo,
        } as VideoTemplateRecord);
        Dialog.tipSuccess(t("common.downloadSuccess"));
        emit("update");
    } catch (e) {
        console.error(e);
        Dialog.tipError(t("common.downloadFailed") + ":" + e);
    } finally {
        Dialog.loadingOff();
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
        width="80vw"
        :footer="false"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
    >
        <template #title>
            {{ $t("model.cloudVideoAvatar") }}
        </template>
        <div style="height: calc(100vh - 15rem)">
            <div>
                <a-alert class="mb-3">
                    {{ $t("model.cloudVideoAvatarDesc") }}
                </a-alert>
            </div>
            <div class="mb-3 flex gap-2">
                <a-button
                    v-for="tag in allTags"
                    :key="tag"
                    size="small"
                    :type="selectedTags.includes(tag) ? 'primary' : 'outline'"
                    @click="toggleTag(tag)"
                >
                    {{ tag }}
                </a-button>
            </div>
            <div>
                <m-loading page v-if="loading && !records.length" />
                <m-empty v-if="!loading && !records.length" />
                <div class="flex flex-wrap -mx-2">
                    <div v-for="r in filteredRecords" :key="r.id" class="w-1/3 flex-shrink-0 p-2">
                        <div class="rounded-xl shadow border p-4 hover:shadow-lg">
                            <div class="mb-3">
                                <img :src="r.cover" class="w-full h-48 object-contain rounded-lg" />
                            </div>
                            <div class="flex items-center mb-3">
                                <div class="flex-grow font-bold">
                                    {{ r.title }}
                                </div>
                            </div>
                            <div class="flex gap-1 mb-3">
                                <a-tag v-for="tag in r.tags" :key="tag" class="rounded-lg">
                                    {{ tag }}
                                </a-tag>
                            </div>
                            <div class="flex">
                                <a-button @click="doDownload(r)">
                                    <template #icon>
                                        <icon-download />
                                    </template>
                                    {{ $t("avatar.saveToMine") }}
                                </a-button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="h-4"></div>
        </div>
    </a-modal>
</template>

<style scoped></style>
