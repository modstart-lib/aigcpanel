<script setup lang="ts">
import {ref} from "vue";
import {ProviderType} from "../types";
import {useModelStore} from "../store/model";

const modelStore = useModelStore();
const visible = ref(false);
const data = ref({
    title: "",
    type: "openai" as ProviderType,
});
const show = () => {
    data.value.title = "";
    data.value.type = "openai";
    visible.value = true;
};
const doSubmit = () => {
    if (!data.value.title) {
        return;
    }
    modelStore.add(data.value);
    visible.value = false;
};
defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="30rem" :esc-to-close="false" :mask-closable="false" title-align="start">
        <template #title>
            {{ $t("model.addProvider") }}
        </template>
        <template #footer>
            <a-button @click="visible = false">{{ $t("common.cancel") }}</a-button>
            <a-button type="primary" @click="doSubmit">{{ $t("common.confirm") }}</a-button>
        </template>
        <div style="max-height: 50vh" class="overflow-y-auto">
            <a-form :model="data" label-align="left" class="mt-4">
                <a-form-item :label="$t('video.providerName')" name="title">
                    <a-input v-model:model-value="data.title" :placeholder="$t('video.providerName')" />
                </a-form-item>
                <a-form-item :label="$t('setting.interfaceType')" name="type">
                    <a-select v-model:model-value="data.type" :placeholder="$t('setting.interfaceType')">
                        <a-option value="openai">OpenAI</a-option>
                    </a-select>
                </a-form-item>
            </a-form>
        </div>
    </a-modal>
</template>

<style scoped></style>
