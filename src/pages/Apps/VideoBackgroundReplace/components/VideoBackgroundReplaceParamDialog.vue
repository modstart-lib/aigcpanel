<script setup lang="ts">
import { nextTick, ref } from "vue";
import { t } from "../../../../lang";
import VideoBackgroundReplaceParamForm from "./VideoBackgroundReplaceParamForm.vue";

const visible = ref(false);
const paramForm = ref<InstanceType<
    typeof VideoBackgroundReplaceParamForm
> | null>(null);

const show = (data?: any) => {
    visible.value = true;
    nextTick(() => {
        if (data) {
            paramForm.value?.setValue(data);
        }
    });
};

const emit = defineEmits<{
    update: [value: any];
}>();

const doSave = async () => {
    const value = await paramForm.value?.getValue();
    if (value) {
        emit("update", value);
        visible.value = false;
    }
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="80vw" title-align="start">
        <template #title>
            <div class="flex items-center">
                <div class="font-bold mr-2">{{ t("app.vbrSetParams") }}</div>
            </div>
        </template>
        <div>
            <VideoBackgroundReplaceParamForm ref="paramForm" />
        </div>
        <template #footer>
            <a-button @click="visible = false">{{
                $t("common.cancel")
            }}</a-button>
            <a-button type="primary" @click="doSave">{{
                $t("common.save")
            }}</a-button>
        </template>
    </a-modal>
</template>
