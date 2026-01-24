<script setup lang="ts">
import {ref, watch} from "vue";
import {useModelStore} from "../store/model";

const modelStore = useModelStore();
const props = defineProps({
    provider: {
        type: Object,
        default: () => {
            return null;
        },
    },
});
const visible = ref(false);
const data = ref({
    id: "",
    name: "",
    group: "",
});
watch(
    () => data.value.id,
    val => {
        data.value.name = data.value.id;
        data.value.group = data.value.id;
    }
);
const show = () => {
    data.value.id = "";
    data.value.name = "";
    data.value.group = "";
    visible.value = true;
};
const doSubmit = () => {
    if (!data.value.id) {
        return;
    }
    modelStore.modelAdd(props.provider.id, data.value);
    visible.value = false;
};
defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="30rem" :esc-to-close="false" :mask-closable="false" title-align="start">
        <template #title>
            {{ $t("model.add") }}
        </template>
        <template #footer>
            <a-button @click="visible = false">{{ $t("common.cancel") }}</a-button>
            <a-button type="primary" @click="doSubmit">{{ $t("common.confirm") }}</a-button>
        </template>
        <div style="max-height: 50vh" class="overflow-y-auto">
            <a-form :model="data" label-align="left" class="mt-4">
                <a-form-item :label="$t('model.id')" name="title" required>
                    <a-input v-model:model-value="data.id" :placeholder="$t('placeholder.requiredGpt')" />
                </a-form-item>
                <a-form-item :label="$t('model.name')" name="title">
                    <a-input v-model:model-value="data.name" :placeholder="$t('placeholder.gpt35')" />
                </a-form-item>
                <a-form-item :label="$t('group.name')" name="type">
                    <a-input v-model:model-value="data.group" :placeholder="$t('placeholder.chatgpt')" />
                </a-form-item>
            </a-form>
        </div>
    </a-modal>
</template>
