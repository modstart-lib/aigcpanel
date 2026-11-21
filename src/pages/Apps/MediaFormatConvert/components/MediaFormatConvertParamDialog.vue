<script setup lang="ts">
import { nextTick, ref } from "vue";
import { t } from "../../../../lang";
import MediaFormatConvertParamForm from "./MediaFormatConvertParamForm.vue";

const paramForm = ref<InstanceType<typeof MediaFormatConvertParamForm>>();

const props = defineProps<{}>();

const visible = ref(false);
const emit = defineEmits<{
    update: [
        data: {
            targetFormat: string;
            videoCodec: string;
            audioCodec: string;
            videoBitrate: number;
            audioBitrate: number;
            lossless: boolean;
        },
    ];
}>();
const doSubmit = async () => {
    const value = await paramForm.value?.getValue();
    if (!value) {
        return;
    }
    visible.value = false;
    emit("update", {
        targetFormat: value.targetFormat,
        videoCodec: value.videoCodec,
        audioCodec: value.audioCodec,
        videoBitrate: value.videoBitrate,
        audioBitrate: value.audioBitrate,
        lossless: value.lossless,
    });
};

defineExpose({
    show: (data?: any) => {
        visible.value = true;
        nextTick(() => {
            if (data) {
                paramForm.value?.setValue(data);
            }
        });
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        title-align="start"
        :title="t('app.mediaFormatTitle')"
        width="min(600px, 95vw)"
        :destroyOnClose="true"
    >
        <template #footer>
            <div class="flex justify-end space-x-2">
                <a-button type="primary" @click="doSubmit">{{
                    $t("common.save")
                }}</a-button>
            </div>
        </template>
        <div v-if="visible">
            <MediaFormatConvertParamForm ref="paramForm" />
        </div>
    </a-modal>
</template>
