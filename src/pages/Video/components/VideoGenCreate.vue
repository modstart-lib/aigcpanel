<script setup lang="ts">
import {onMounted, ref, watch} from "vue";
import ServerContentInfoAction from "../../../components/Server/ServerContentInfoAction.vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";
import {StorageUtil} from "../../../lib/storage";
import {TimeUtil} from "../../../lib/util";
import {PermissionService} from "../../../service/PermissionService";
import {TaskRecord, TaskService} from "../../../service/TaskService";
import {VideoTemplateRecord, VideoTemplateService} from "../../../service/VideoTemplateService";
import SoundGenerateSelector from "../../Sound/components/SoundGenerateSelector.vue";
import VideoGenForm from "./VideoGenForm.vue";

const videoGenForm = ref<InstanceType<typeof VideoGenForm> | null>(null);

const modelConfig = ref(null);
const formData = ref({
    soundType: "soundGenerate",
    soundGenerateId: 0,
    soundCustomFile: "",
});

const videoTemplateRecords = ref<VideoTemplateRecord[]>([]);

onMounted(() => {
    const old = StorageUtil.getObject("VideoGenCreate.formData");
    formData.value.soundType = old.soundType || "soundGenerate";
    formData.value.soundGenerateId = old.soundGenerateId || 0;
    formData.value.soundCustomFile = old.soundCustomFile || "";
});

watch(
    () => formData.value,
    async value => {
        StorageUtil.set("VideoGenCreate.formData", value);
    },
    {
        deep: true,
    }
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
    } else {
        Dialog.tipError("unknown soundType");
        return;
    }
    const record: TaskRecord = {
        biz: "VideoGen",
        title: await window.$mapi.file.textToName(videoGenValue.videoTemplateName + "_" + TimeUtil.datetimeString()),
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
};

const refresh = async (type: "videoTemplate") => {
    if (type === "videoTemplate") {
        videoTemplateRecords.value = await VideoTemplateService.list();
    }
};

const doSoundCustomSelect = async () => {
    const path = await window.$mapi.file.openFile({
        filters: [
            {name: "*.wav", extensions: ["wav"]},
            {name: "*.mp3", extensions: ["mp3"]},
        ],
    });
    if (!path) {
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
        <VideoGenForm ref="videoGenForm" />
        <div class="font-bold">
            <icon-settings />
            {{ $t("voice.config") }}
        </div>
        <div class="flex items-center h-12">
            <div class="mr-1">
                <a-tooltip :content="$t('voice.voice')" mini>
                    <i class="iconfont icon-sound"></i>
                    {{ $t("voice.voice") }}
                </a-tooltip>
            </div>
            <div class="mr-1">
                <a-radio-group v-model="formData.soundType">
                    <a-radio value="soundGenerate">
                        <i class="iconfont icon-sound-generate"></i>
                        {{ $t("voice.synthesis") }}
                    </a-radio>
                    <a-radio value="soundCustom">
                        <icon-file />
                        {{ $t("common.localFile") }}
                    </a-radio>
                </a-radio-group>
            </div>
            <div class="mr-3 w-96 flex-shrink-0" v-if="formData.soundType === 'soundGenerate'">
                <SoundGenerateSelector v-model="formData.soundGenerateId" />
            </div>
            <div class="mr-3 w-96 flex-shrink-0" v-if="formData.soundType === 'soundCustom'">
                <a-button @click="doSoundCustomSelect">
                    <div v-if="formData.soundCustomFile">
                        {{ fileName(formData.soundCustomFile) }}
                    </div>
                    <div v-else>{{ $t("common.selectLocalFile") }}</div>
                </a-button>
            </div>
        </div>
        <div class="pt-4">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                {{ $t("task.startVideoGen") }}
            </a-button>
            <ServerContentInfoAction :config="modelConfig as any" func="videoGen" />
        </div>
    </div>
</template>
