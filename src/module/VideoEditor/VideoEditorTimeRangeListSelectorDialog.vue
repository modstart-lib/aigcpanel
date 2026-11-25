<script setup lang="ts">
import { ref } from "vue";
import { t } from "../../lang";
import { ffprobeVideoInfo } from "../../lib/ffprobe";
import { wait } from "../../lib/util";
import { VIDEO_PREVIEW_FIXED_FPS } from "./core/config";
import { VideoEditorData } from "./core/type";
import VideoEditor from "./VideoEditor.vue";

const visible = ref(false);
const videoEditor = ref<InstanceType<typeof VideoEditor> | null>(null);

export type VideoEditorTimeRangeRecord = {
    startMs: number;
    endMs: number;
    raw?: any;
};
const emit = defineEmits<{
    save: [times: VideoEditorTimeRangeRecord[]];
}>();

const doSubmit = async () => {
    if (!videoEditor.value) {
        return;
    }
    const times: VideoEditorTimeRangeRecord[] = [];
    const data: VideoEditorData = await videoEditor.value.getData();
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
    visible.value = false;
    emit("save", times);
};

defineExpose({
    show: async (video: string, times: VideoEditorTimeRangeRecord[]) => {
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
            {
                locked: true,
            },
        );
        // console.log('times', JSON.stringify(times, null, 2))
        for (const time of times) {
            await videoEditor.value!.addTrackFromBuildIn(
                {
                    duration: (time.endMs - time.startMs) / 1000,
                    start: Math.floor(
                        (time.startMs * VIDEO_PREVIEW_FIXED_FPS) / 1000,
                    ),
                    ...time.raw,
                },
                "TimeRangeSelector",
                {
                    trackerNameType: "duration",
                    positionLocked: true,
                    sizeLocked: true,
                    initScale: 0.9,
                },
            );
        }
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        :title="t('videoEditor.timeSegmentTitle')"
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
            <VideoEditor ref="videoEditor" mode="timeRangesSelector" />
        </div>
    </a-modal>
</template>
