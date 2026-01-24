<script setup lang="ts">
import {ref} from "vue";
import {serverSoundGenerate} from "../../../lib/server";
import {Dialog} from "../../../lib/dialog";
import {t} from "../../../lang";
import {ObjectUtil} from "../../../lib/util";
import AudioPlayerButton from "../../../components/common/AudioPlayerButton.vue";
import SoundGenerateFormViewBody from "./SoundGenerateFormViewBody.vue";

const props = defineProps<{
    soundGenerate: SoundGenerateParamType,
}>();
const text = ref("");
const loading = ref(false);
const requestSecond = ref(0);
const previewUrl = ref("");
const request = async () => {
    return new Promise((resolve, reject) => {
        const process = async () => {
            try {
                const ret = await serverSoundGenerate(
                    "SoundReplace",
                    "0",
                    ObjectUtil.clone(props.soundGenerate),
                    {},
                    text.value
                );
                if (ret.type === "success") {
                    resolve(ret.url);
                } else {
                    setTimeout(process, 1000);
                }
            } catch (e) {
                reject(e);
            }
        };
        process();
    });
}
const doPreview = async () => {
    if (!text.value.trim()) {
        return;
    }
    previewUrl.value = "";
    loading.value = true;
    requestSecond.value = 0;
    const interval = setInterval(() => {
        requestSecond.value++;
    }, 1000);
    request().then((url) => {
        Dialog.tipSuccess(t('msg.requestSuccessPlaying'));
        previewUrl.value = url as string;
        const audio = new Audio(`file://${url}`);
        audio.play();
    }).catch((e) => {
        console.error(e);
        Dialog.tipError(t('error.requestFailed') + ':' + e + '')
    }).finally(() => {
        loading.value = false;
        requestSecond.value = 0;
        clearInterval(interval);
    });
};
</script>

<template>
    <div class="flex items-center gap-2">
        <a-input
            v-model="text"
            :placeholder="$t('hint.inputPreviewText')"
            style="width: 200px"
            allow-clear
            class="flex-grow"
        />
        <div v-if="loading">({{ requestSecond }}s)</div>
        <a-popover position="left">
            <a-button type="text" status="normal" class="text-gray-400">
                <template #icon>
                    <icon-settings/>
                </template>
            </a-button>
            <template #content>
                <div class="mb-2 font-bold">
                    {{ $t("voice.currentConfig") }}
                </div>
                <div class="flex gap-2">
                    <SoundGenerateFormViewBody :data="props.soundGenerate as any"/>
                </div>
            </template>
        </a-popover>
        <a-button @click="doPreview"
                  :loading="loading"
                  :disabled="!text.trim()">
            <template #icon>
                <icon-send/>
            </template>
            {{ $t("task.synthesize") }}
        </a-button>
        <a-button v-if="previewUrl">
            <template #icon>
                <AudioPlayerButton :source="previewUrl"/>
            </template>
        </a-button>
    </div>
</template>

