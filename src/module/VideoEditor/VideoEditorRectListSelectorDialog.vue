<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { t } from "../../lang";
import { ffprobeVideoInfo } from "../../lib/ffprobe";
import { wait } from "../../lib/util";
import { VIDEO_PREVIEW_FIXED_FPS } from "./core/config";
import { VideoEditorData } from "./core/type";
import VideoEditor from "./VideoEditor.vue";
import { dataAutoSaveDraft } from "../../components/common/util";

const visible = ref(false);
const videoEditor = ref<InstanceType<typeof VideoEditor> | null>(null);
const currentTimes = ref<VideoEditorRectRecord[]>([]);
const clearDraftValue = ref<() => void>();
const autoSaveTimer = ref<any>();

const props = defineProps<{
    defaultDuration?: number;
}>();
export type VideoEditorRectRecord = {
    startMs: number;
    endMs: number;
    x: number;
    y: number;
    width: number;
    height: number;
    raw?: any;
};

const emit = defineEmits<{
    save: (times: VideoEditorRectRecord[]) => void;
}>();

const sync = async () => {
    const times: VideoEditorRectRecord[] = [];
    const data: VideoEditorData = (await videoEditor.value?.getData()) as any;
    data.tracks
        .filter((t) => t.type === "image")
        .forEach((t) => {
            t.list.forEach((item) => {
                if (item.type === "image") {
                    const startMs = Math.floor(
                        (item.start / VIDEO_PREVIEW_FIXED_FPS) * 1000,
                    );
                    const endMs = Math.floor(
                        ((item.end + 1) / VIDEO_PREVIEW_FIXED_FPS) * 1000,
                    );
                    times.push({
                        startMs,
                        endMs,
                        ...item.rect,
                        raw: {
                            centerX: item.centerX,
                            centerY: item.centerY,
                            scaleX: item.scaleX,
                            scaleY: item.scaleY,
                            width: item.width,
                            height: item.height,
                        },
                    });
                }
            });
        });
    // sort times by startMs
    times.sort((a, b) => a.startMs - b.startMs);
    currentTimes.value.splice(0, currentTimes.value.length, ...times);
    // console.log('sync times', JSON.stringify(currentTimes.value, null, 2));
};

const doSubmit = async () => {
    if (!videoEditor.value) {
        return;
    }
    await sync();
    visible.value = false;
    if (autoSaveTimer.value) {
        clearInterval(autoSaveTimer.value);
    }
    if (clearDraftValue.value) {
        clearDraftValue.value();
    }
    // @ts-ignore
    emit("save", currentTimes.value);
};

onBeforeUnmount(() => {
    if (autoSaveTimer.value) {
        clearInterval(autoSaveTimer.value);
    }
});

defineExpose({
    show: async (video: string, times: VideoEditorRectRecord[]) => {
        visible.value = true;
        await wait(() => !!videoEditor.value);
        // console.log('videoEditor', videoEditor.value);
        const { width, height, fps } = await ffprobeVideoInfo(video);
        await videoEditor.value!.setSetting({
            width,
            height,
            fps,
        });
        await videoEditor.value!.addVideoTrack(
            {
                url: "",
                name: "",
                format: "",
                start: 0,
            },
            video,
            { locked: true },
        );
        // console.log('times', JSON.stringify(times, null, 2))
        currentTimes.value = times;
        if (currentTimes.value.length === 0) {
            const { clearDraft, load } = dataAutoSaveDraft(
                "VideoEditorRectListSelectorDialog.Data",
                currentTimes.value,
                {
                    type: "array",
                    confirmText: t("videoEditor.restoreDraftConfirm"),
                },
            );
            clearDraftValue.value = clearDraft;
            await load();
        }
        for (const time of currentTimes.value) {
            await videoEditor.value!.addTrackFromBuildIn(
                {
                    duration: (time.endMs - time.startMs) / 1000,
                    start: Math.floor(
                        (time.startMs * VIDEO_PREVIEW_FIXED_FPS) / 1000,
                    ),
                    ...time.raw,
                },
                "RectSelector",
                {
                    initScale: 0.5,
                    trackerNameType: "duration",
                },
            );
        }
        if (autoSaveTimer.value) {
            clearInterval(autoSaveTimer.value);
        }
        autoSaveTimer.value = setInterval(async () => {
            await sync();
        }, 5 * 1000);
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        :title="t('videoEditor.regionSegmentTitle')"
        title-align="start"
        width="98vw"
        :mask-closable="false"
    >
        <template #footer>
            <a-button @click="visible = false">{{
                t("common.cancel")
            }}</a-button>
            <a-button type="primary" @click="doSubmit">{{
                t("common.confirm")
            }}</a-button>
        </template>
        <div
            v-if="visible"
            class="-mx-5 -my-6 overflow-hidden"
            style="height: calc(100vh - 200px)"
        >
            <VideoEditor
                ref="videoEditor"
                mode="rectsSelector"
                :option="{
                    defaultRectSelectorDuration: props.defaultDuration,
                }"
            />
        </div>
    </a-modal>
</template>
