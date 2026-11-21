<script setup lang="ts">
import { nextTick, ref } from "vue";
import VideoKeepPartParamForm from "./VideoKeepPartParamForm.vue";

const props = defineProps<{}>();

const emit = defineEmits<{
    update: [data: { action: "keep" | "remove" }];
}>();

const visible = ref(false);
const paramForm = ref<InstanceType<typeof VideoKeepPartParamForm>>();

const show = (data?: any) => {
    visible.value = true;
    nextTick(() => {
        if (data) {
            paramForm.value?.setValue(data);
        }
    });
};

const doSubmit = async () => {
    const value = await paramForm.value?.getValue();
    if (!value) {
        return;
    }
    visible.value = false;
    emit("update", value);
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" :footer="false" title-align="start">
        <template #title>
            <div class="flex items-center">
                <div class="font-bold mr-2">{{ $t("app.paramTitle") }}</div>
            </div>
        </template>
        <div>
            <VideoKeepPartParamForm ref="paramForm" />
            <div class="flex justify-end mt-4 pt-4 border-t">
                <a-button class="mr-2" @click="visible = false">
                    {{ $t("common.cancel") }}
                </a-button>
                <a-button type="primary" @click="doSubmit">
                    {{ $t("common.confirm") }}
                </a-button>
            </div>
        </div>
    </a-modal>
</template>
