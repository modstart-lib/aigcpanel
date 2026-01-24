<script setup lang="ts">
import {computed, ref, watch} from "vue";
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
    modelId: "",
});
const enabledModels = computed(() => {
    if (props.provider) {
        return props.provider.data.models.filter((model: any) => model.enabled);
    }
    return [];
});
watch(enabledModels, newVal => {
    let exists = false;
    for (const model of newVal) {
        if (model.id === data.value.modelId) {
            exists = true;
            break;
        }
    }
    if (!exists) {
        if (newVal.length > 0) {
            data.value.modelId = newVal[0].id;
        } else {
            data.value.modelId = "";
        }
    }
});
const show = () => {
    visible.value = true;
};
const doSubmit = async () => {
    if (!data.value.modelId) {
        return;
    }
    await modelStore.test(props.provider.id, data.value.modelId);
};
defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="20rem" :esc-to-close="false" :mask-closable="false" title-align="start">
        <template #title>
            {{ $t("hint.selectModelCheck") }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSubmit">{{ $t("common.test") }}</a-button>
            <a-button @click="visible = false">{{ $t("common.close") }}</a-button>
        </template>
        <div style="max-height: 50vh" class="overflow-y-auto" v-if="props.provider">
            <a-form :model="data" layout="vertical" class="mt-4">
                <a-form-item name="modelId">
                    <a-select v-model:model-value="data.modelId">
                        <a-option v-for="model in enabledModels" :key="model.id" :value="model.id">
                            {{ model.name }}
                        </a-option>
                    </a-select>
                </a-form-item>
            </a-form>
        </div>
    </a-modal>
</template>

<style scoped></style>
