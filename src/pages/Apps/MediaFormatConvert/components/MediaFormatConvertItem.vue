<script setup lang="ts">
import { t } from "../../../../lang";
import TaskCancelAction from "../../../../components/Server/TaskCancelAction.vue";
import TaskContinueAction from "../../../../components/Server/TaskContinueAction.vue";
import TaskRetryAction from "../../../../components/Server/TaskRetryAction.vue";
import TaskDeleteAction from "../../../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../../../components/Server/TaskDuration.vue";
import TaskPercent from "../../../../components/Server/TaskPercent.vue";
import TaskTitleField from "../../../../components/Server/TaskTitleField.vue";
import TaskBizStatus from "../../../../components/common/TaskBizStatus.vue";
import TaskJobResultStepView from "../../../../components/common/TaskJobResultStepView.vue";
import VideoPreviewBox from "../../../../components/common/VideoPreviewBox.vue";
import { TaskRecord } from "../../../../service/TaskService";
import VideoInfo from "../../common/VideoInfo.vue";
import {
    MediaFormatConvertJobResultType,
    MediaFormatConvertModelConfigType,
} from "../type";
import MediaFormatConvertParamView from "./MediaFormatConvertParamView.vue";

const props = defineProps<{
    record: TaskRecord<
        MediaFormatConvertModelConfigType,
        MediaFormatConvertJobResultType
    >;
    dialog: boolean;
    onRefresh: () => void;
}>();

const getFormatInfo = (): { label: string; value: string }[] => {
    const config = props.record.modelConfig;
    if (!config) return [];

    const info: { label: string; value: string }[] = [];

    // target format
    info.push({
        label: t("app.targetFormat"),
        value: config.targetFormat.toUpperCase(),
    });

    // video codec
    if (config.videoCodec && !config.lossless) {
        let codecName = config.videoCodec;
        if (codecName === "libx264") codecName = "H.264";
        if (codecName === "libx265") codecName = "H.265/HEVC";
        if (codecName === "libvpx-vp9") codecName = "VP9";

        info.push({
            label: t("app.videoCodec"),
            value: codecName,
        });

        // video bitrate
        if (config.videoBitrate > 0) {
            info.push({
                label: t("app.videoBitrate"),
                value: `${config.videoBitrate} kbps`,
            });
        }
    }

    // audio codec
    if (config.audioCodec && !config.lossless) {
        let codecName = config.audioCodec;
        if (codecName === "aac") codecName = "AAC";
        if (codecName === "libmp3lame") codecName = "MP3";
        if (codecName === "libopus") codecName = "Opus";
        if (codecName === "pcm_s16le") codecName = "PCM";
        if (codecName === "flac") codecName = "FLAC";

        info.push({
            label: t("app.audioCodec"),
            value: codecName,
        });

        // audio bitrate
        if (config.audioBitrate > 0) {
            info.push({
                label: t("app.audioBitrate"),
                value: `${config.audioBitrate} kbps`,
            });
        }
    }

    // lossless mode
    info.push({
        label: t("app.convertMode"),
        value: config.lossless
            ? t("app.losslessConvert")
            : t("app.lossyConvert"),
    });

    return info;
};
</script>

<template>
    <div class="rounded-xl shadow border p-4 mb-4 hover:shadow-lg">
        <div class="flex items-center gap-1">
            <div
                class="inline-flex items-start bg-blue-100 rounded-full px-2 leading-8 h-8 mr-2"
            >
                <div v-if="!dialog" class="mr-2 h-8 pt-0.5">
                    <a-checkbox v-model="record['_check']" />
                </div>
                <div class="">
                    <TaskTitleField
                        :record="record"
                        :disabled="dialog"
                        @title-click="record['_check'] = !record['_check']"
                        @update="(v) => (record.title = v)"
                    />
                </div>
            </div>
            <div class="flex-grow"></div>
            <TaskPercent
                v-if="record.status === 'running'"
                :percent="record.result?.percent"
            />
            <TaskDuration :start="record.startTime" :end="record.endTime" />
            <TaskBizStatus
                :status="record.status"
                :status-msg="record.statusMsg"
            />
        </div>
        <div class="mt-3 flex items-center">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-file />
                    {{ $t("app.parseMedia") }}
                </div>
            </div>
            <div class="flex-grow">
                <TaskJobResultStepView :record="record" step="Prepare">
                    <div class="flex flex-wrap gap-1">
                        <template v-if="record.jobResult?.Prepare.isVideo">
                            <VideoInfo :data="record.jobResult?.Prepare" />
                        </template>
                        <template v-else>
                            <a-tag class="rounded-lg">{{
                                t("app.durationSeconds", {
                                    value: record.jobResult?.Prepare.duration?.toFixed(
                                        1,
                                    ),
                                })
                            }}</a-tag>
                            <a-tag
                                v-if="record.jobResult?.Prepare.audioChannels"
                                class="rounded-lg"
                                >{{ t("app.channels") }}
                                {{ record.jobResult?.Prepare.audioChannels }}
                            </a-tag>
                            <a-tag
                                v-if="record.jobResult?.Prepare.audioSampleRate"
                                class="rounded-lg"
                                >{{ t("app.sampleRate") }}
                                {{ record.jobResult?.Prepare.audioSampleRate }}
                                Hz
                            </a-tag>
                        </template>
                    </div>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex items-center">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-settings />
                    {{ $t("app.formatConfig") }}
                </div>
            </div>
            <div class="flex-grow">
                <TaskJobResultStepView :record="record" step="Config">
                    <div class="flex items-center gap-1 mb-2 flex-wrap">
                        <MediaFormatConvertParamView
                            :data="record.modelConfig!"
                        />
                    </div>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-swap />
                    {{ $t("app.formatConvert") }}
                </div>
            </div>
            <TaskJobResultStepView :record="record" step="Convert">
                <div>
                    <template v-if="record.jobResult?.Prepare.isVideo">
                        <VideoPreviewBox
                            :url="record.jobResult?.Convert.file"
                        />
                    </template>
                    <template v-else>
                        <div class="flex items-center">
                            <icon-sound class="text-2xl mr-2" />
                            <span>{{ $t("app.audioConverted") }}</span>
                        </div>
                    </template>
                </div>
            </TaskJobResultStepView>
        </div>
        <div class="pt-4 flex items-center">
            <div class="text-gray-400 text-xs mr-2">#{{ record.id }}</div>
            <div class="text-gray-400 flex-grow">
                <timeago :datetime="record['createdAt'] * 1000" />
            </div>
            <div class="">
                <TaskDownloadAction :record="record" />
                <TaskDeleteAction
                    v-if="!dialog"
                    :record="record"
                    @update="onRefresh"
                />
                <TaskContinueAction :record="record" @update="onRefresh" />
                <TaskRetryAction :record="record" @update="onRefresh" />
                <TaskCancelAction :record="record" />
            </div>
        </div>
    </div>
</template>
