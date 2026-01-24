<script setup lang="ts">
import {ref} from "vue";
import {useModelStore} from "../store/model";
import {Model} from "../types";

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
const show = (model: Model) => {
    data.value.id = model.id;
    data.value.name = model.name;
    data.value.group = model.group;
    visible.value = true;
};
const doSubmit = () => {
    if (!data.value.id) {
        return;
    }
    modelStore.modelEdit(props.provider.id, data.value);
    visible.value = false;
};
defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="30rem" :esc-to-close="false" :mask-closable="false" title-align="start">
        <template #title>
            {{ $t("model.edit") }}
        </template>
        <template #footer>
            <a-button @click="visible = false">{{ $t("common.cancel") }}</a-button>
            <a-button type="primary" @click="doSubmit">{{ $t("common.confirm") }}</a-button>
        </template>
        <div style="max-height: 50vh" class="overflow-y-auto">
            <a-form :model="data" label-align="left" class="mt-4">
                <a-form-item :label="$t('model.id')" name="title" required>
                    <a-input
                        v-model:model-value="data.id"
                        readonly
                        disabled
                        :placeholder="$t('placeholder.requiredGpt')"
                    />
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
