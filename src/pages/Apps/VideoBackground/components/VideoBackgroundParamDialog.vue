<script setup lang="ts">
import { nextTick, ref } from "vue";
import { t } from "../../../../lang";
import VideoBackgroundParamForm from "./VideoBackgroundParamForm.vue";

const props = defineProps<{}>();

const visible = ref(false);
const paramForm = ref<InstanceType<typeof VideoBackgroundParamForm> | null>(
    null,
);

const show = (data?: any) => {
    visible.value = true;
    nextTick(() => {
        if (data) {
            paramForm.value?.setValue(data);
        }
    });
};

const edit = (record: any) => {
    console.log("编辑记录:", record);
    show();
};

const add = () => {
    console.log("添加新记录");
    show();
};

const emit = defineEmits<{
    update: [value: any];
}>();

const doSave = async () => {
    const value = await paramForm.value?.getValue();
    if (value) {
        console.log("保存参数:", value);
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
                <div class="font-bold mr-2">{{ t("app.setParams") }}</div>
            </div>
        </template>
        <div>
            <VideoBackgroundParamForm ref="paramForm" />
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
