<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref, watch } from "vue";
import ServerContentInfoAction from "../../../components/Server/ServerContentInfoAction.vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { StorageUtil } from "../../../lib/storage";
import { TimeUtil } from "../../../lib/util";
import { FileUtil } from "../../../lib/file";
import { PermissionService } from "../../../service/PermissionService";
import { TaskRecord, TaskService } from "../../../service/TaskService";
import {
    VideoTemplateRecord,
    VideoTemplateService,
} from "../../../service/VideoTemplateService";
import SoundGenerateSelector from "./SoundGenerateSelector.vue";
import VideoGenForm from "./VideoGenForm.vue";

const videoGenForm = ref<InstanceType<typeof VideoGenForm> | null>(null);

const modelConfig = ref(null);
const formData = ref({
    soundType: "soundGenerate",
    soundGenerateId: 0,
    soundCustomFile: "",
});

const videoTemplateRecords = ref<VideoTemplateRecord[]>([]);

onMounted(async () => {
    const old = StorageUtil.getObject("VideoGenCreate.formData");
    formData.value.soundType = old.soundType || "soundGenerate";
    formData.value.soundGenerateId = old.soundGenerateId || 0;
    formData.value.soundCustomFile = old.soundCustomFile || "";
    // A restored local file that no longer exists (deleted/moved) would only
    // fail much later with a cryptic "文件不存在" from the model, so drop it now
    // and make the user pick the file again.
    if (
        formData.value.soundCustomFile &&
        !(await $mapi.file.exists(formData.value.soundCustomFile))
    ) {
        formData.value.soundCustomFile = "";
    }
    
});

onUnmounted(() => {
    
});

watch(
    () => formData.value,
    async (value) => {
        StorageUtil.set("VideoGenCreate.formData", value);
    },
    {
        deep: true,
    },
);

const doSubmit = async () => {
    const videoGenValue = await videoGenForm.value?.getValue();
    if (!videoGenValue) {
        return;
    }
    let soundRecord: TaskRecord | null = null;
    let soundCustomFile: string | null = null;
    if (formData.value.soundType === "soundGenerate") {
        if (!formData.value.soundGenerateId) {
            Dialog.tipError(t("hint.selectVoice"));
            return;
        }
        soundRecord = await TaskService.get(formData.value.soundGenerateId);
        if (!soundRecord) {
            Dialog.tipError(t("hint.selectVoice"));
            return;
        }
    } else if (formData.value.soundType === "soundCustom") {
        soundCustomFile = formData.value.soundCustomFile;
        if (!soundCustomFile) {
            Dialog.tipError(t("hint.selectVoice"));
            return;
        }
        // Validate right away instead of dispatching a task that can only fail
        // inside the model with "文件不存在".
        if (!(await $mapi.file.exists(soundCustomFile))) {
            Dialog.tipError(t("error.audioFileNotSelected"));
            formData.value.soundCustomFile = "";
            return;
        }
    } else {
        Dialog.tipError("unknown soundType");
        return;
    }
    const record: TaskRecord = {
        biz: "VideoGen",
        title: await window.$mapi.file.textToName(
            videoGenValue.videoTemplateName + "_" + TimeUtil.datetimeString(),
        ),
        serverName: videoGenValue.serverName,
        serverTitle: videoGenValue.serverTitle,
        serverVersion: videoGenValue.serverVersion,
        modelConfig: {
            videoTemplateId: videoGenValue.videoTemplateId,
            videoTemplateName: videoGenValue.videoTemplateName,
            videoTemplateUrl: videoGenValue.videoTemplateUrl,
            soundType: formData.value.soundType,
            soundGenerateId: formData.value.soundGenerateId as number,
            soundGenerateText: soundRecord ? soundRecord.modelConfig.text : "",
            soundCustomFile: soundCustomFile || "",
        },
        param: videoGenValue.param,
    };
    if (!(await PermissionService.checkForTask("VideoGen", record))) {
        return;
    }
    const id = await TaskService.submit(record);
    Dialog.tipSuccess(t("task.videoGenSubmitted"));
    emit("submitted");
    return id;
};

const refresh = async (type: "videoTemplate") => {
    if (type === "videoTemplate") {
        videoTemplateRecords.value = await VideoTemplateService.list();
    }
};

const doSoundCustomSelect = async () => {
    const path = await window.$mapi.file.openFile({
        filters: [
            { name: "*.wav", extensions: ["wav"] },
            { name: "*.mp3", extensions: ["mp3"] },
        ],
    });
    if (!path) {
        return;
    }
    // Validate extension again to prevent selecting unsupported formats
    // via "All Files" in the system file dialog
    const ext = FileUtil.getExt(path);
    if (!["wav", "mp3"].includes(ext)) {
        Dialog.tipError(
            t("hint.selectFileFormat", {
                extensions: "wav,mp3",
            }),
        );
        return;
    }
    formData.value.soundCustomFile = path;
};

const fileName = (fullPath: string) => {
    return fullPath.replace(/\\/g, "/").split("/").pop() || "";
};

const emit = defineEmits({
    submitted: () => true,
});

defineExpose({
    refresh,
});
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <VideoGenForm ref="videoGenForm">
            <div class="font-bold mb-2">
                <icon-settings />
                {{ $t("voice.config") }}
            </div>
            <div class="flex items-center flex-wrap gap-2">
                <div class="flex items-center gap-1 flex-shrink-0">
                    <i-mdi-volume-high class="w-4 h-4" />
                    <span>{{ $t("voice.voice") }}</span>
                </div>
                <a-radio-group
                    v-model="formData.soundType"
                    class="flex-shrink-0"
                >
                    <a-radio value="soundGenerate">
                        <i-mdi-text-to-speech
                            class="w-4 h-4 inline-block align-middle"
                        />
                        {{ $t("voice.synthesis") }}
                    </a-radio>
                    <a-radio value="soundCustom">
                        <icon-file />
                        {{ $t("common.localFile") }}
                    </a-radio>
                </a-radio-group>
                <div
                    class="flex-shrink-0 min-w-64"
                    v-if="formData.soundType === 'soundGenerate'"
                >
                    <SoundGenerateSelector v-model="formData.soundGenerateId" />
                </div>
                <div
                    class="flex-shrink-0"
                    v-if="formData.soundType === 'soundCustom'"
                >
                    <a-button @click="doSoundCustomSelect">
                        <div v-if="formData.soundCustomFile">
                            {{ fileName(formData.soundCustomFile) }}
                        </div>
                        <div v-else>{{ $t("common.selectLocalFile") }}</div>
                    </a-button>
                </div>
            </div>
        </VideoGenForm>
        <div class="pt-4">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                {{ $t("task.startVideoGen") }}
            </a-button>
            <ServerContentInfoAction
                :config="modelConfig as any"
                func="videoGen"
            />
        </div>
    </div>
</template>
