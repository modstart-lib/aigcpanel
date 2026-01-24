<script setup lang="ts">
import {ref} from "vue";
import AudioPlayer from "../../../components/common/AudioPlayer.vue";
import {AudioUtil} from "../../../lib/audio";
import WebFileSelectButton from "../../../components/common/WebFileSelectButton.vue";
import {Dialog} from "../../../lib/dialog";
import {t} from "../../../lang";
import {StorageService} from "../../../service/StorageService";
import {DataService} from "../../../service/DataService";

const visible = ref(false);
const audioPlayer = ref<InstanceType<typeof AudioPlayer>>();

const formData = ref({
    name: "",
    promptWav: "",
    promptText: "",
});

const add = () => {
    formData.value.name = "";
    formData.value.promptWav = "";
    formData.value.promptText = "";
    visible.value = true;
};

const onSelectFile = async file => {
    await audioPlayer.value?.setRecordFromFile(file);
};

const doSave = async () => {
    if (!formData.value.name) {
        Dialog.tipError(t("hint.inputName"));
        return;
    }
    const audioBuffer = audioPlayer.value?.getAudioBuffer();
    if (!audioBuffer) {
        Dialog.tipError(t("hint.recordVoice"));
        return;
    }
    if (!formData.value.promptText) {
        Dialog.tipError(t("hint.inputRefText"));
        return;
    }
    const exists = await StorageService.getByTitle("SoundPrompt", formData.value.name);
    if (exists) {
        Dialog.tipError(t("error.nameDuplicate"));
        return;
    }
    const duration = AudioUtil.audioBufferDuration(audioBuffer);
    if (duration > 20 || duration < 6) {
        Dialog.tipError(t("voice.refAudioGuide2"));
        return;
    }
    const wav = AudioUtil.audioBufferToWav(audioBuffer);
    formData.value.promptWav = await DataService.saveBuffer("wav", wav);
    await StorageService.add("SoundPrompt", {
        title: formData.value.name,
        content: {
            url: formData.value.promptWav,
            promptText: formData.value.promptText,
        },
    });
    visible.value = false;
    emit("update");
};

defineExpose({
    add,
});

const emit = defineEmits({
    update: () => true,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="800px" title-align="start">
        <template #title>
            {{ $t("voice.add") }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSave">
                {{ $t("common.save") }}
            </a-button>
        </template>
        <div style="max-height: 60vh">
            <div class="flex">
                <div class="w-1/2 flex-shrink-0 mr-5">
                    <a-form :model="{}" layout="vertical">
                        <a-form-item :label="$t('common.name')" required>
                            <a-input v-model="formData.name" />
                        </a-form-item>
                        <a-form-item :label="$t('voice.referenceAudio')" required>
                            <div class="w-full">
                                <div class="mb-3">
                                    <a-alert>
                                        {{ $t("voice.refAudioGuide1") }}
                                    </a-alert>
                                </div>
                                <div class="mb-3">
                                    <AudioPlayer ref="audioPlayer" show-wave trim-enable record-enable />
                                </div>
                                <div class="mb-3 text-gray-400 flex items-center">
                                    <div class="flex-grow text-sm">
                                        <icon-info-circle />
                                        {{ $t("hint.audioFormat") }}
                                    </div>
                                    <div>
                                        <WebFileSelectButton @select-file="onSelectFile" accept="audio/wav,audio/mp3">
                                            <a-button>
                                                <template #icon>
                                                    <icon-upload />
                                                </template>
                                                {{ $t("voice.selectFile") }}
                                            </a-button>
                                        </WebFileSelectButton>
                                    </div>
                                </div>
                            </div>
                        </a-form-item>
                        <a-form-item :label="$t('voice.referenceText')" required>
                            <div class="w-full">
                                <div class="mb-3">
                                    <a-input v-model="formData.promptText" />
                                </div>
                                <div class="text-gray-400 text-sm">
                                    <icon-info-circle />
                                    {{ $t("voice.refTextRequired") }}
                                </div>
                            </div>
                        </a-form-item>
                    </a-form>
                </div>
                <div class="flex-grow">
                    <div class="text-lg font-bold">{{ $t("voice.timbreDesc") }}</div>
                    <div class="bg-gray-100 mt-2 p-3 rounded-lg leading-6 text-xs">
                        <div>{{ $t("guide.audioReq1") }}</div>
                        <div>{{ $t("guide.audioReq2") }}</div>
                        <div>{{ $t("guide.audioReq3") }}</div>
                        <div>{{ $t("guide.audioReq4") }}</div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
