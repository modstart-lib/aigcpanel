<script setup lang="ts">
import {useModelStore} from "./store/model";
import {computed, ref} from "vue";
import {getModelLogo} from "./models";

type ModelRecord = {
    providerId: string;
    providerTitle: string;
    modelId: string;
    modelName: string;
};
const model = useModelStore();
const availableModels = computed(() => {
    const models: ModelRecord[] = [];
    for (const p of model.providers) {
        if (!p.data.enabled) {
            continue;
        }
        for (const m of p.data.models) {
            if (!m.enabled) {
                continue;
            }
            models.push({
                providerId: p.id,
                providerTitle: p.title,
                modelId: m.id,
                modelName: m.name,
            } as ModelRecord);
        }
    }
    return models;
});
const select = ref<any>(null);
const selectedProvider = computed(() => {
    if (select.value?.modelValue) {
        const [providerId, modelId] = select.value.modelValue.split("|");
        for (const p of model.providers) {
            if (p.id === providerId) {
                return p;
            }
        }
    } else {
        return null;
    }
});
const selectedModel = computed(() => {
    const [providerId, modelId] = select.value.modelValue.split("|");
    if (!selectedProvider.value) {
        return null;
    }
    for (const m of selectedProvider.value.data.models) {
        if (m.id === modelId) {
            return m;
        }
    }
    return null;
});
defineExpose({
    getInfo: () => {
        return {
            providerLogo: getModelLogo(selectedModel.value?.id || ''),
            providerTitle: selectedProvider.value?.title || '',
            modelName: selectedModel.value?.name || '',
        };
    },
});
</script>

<template>
    <a-select ref="select" style="width:auto;" :placeholder="$t('model.select')">
        <template #label>
            <div class="flex items-center" v-if="selectedProvider && selectedModel">
                <div class="mr-1">
                    <a-avatar
                        :image-url="getModelLogo(selectedModel.id)"
                        :size="20"
                        shape="square"
                        style="border: 1px solid #ccc"
                    />
                </div>
                <div class="mr-1">
                    {{ selectedProvider?.title }}
                </div>
                <div class="mr-1 text-gray-400">/</div>
                <div>
                    {{ selectedModel.name }}
                </div>
            </div>
            <div class="flex items-center" v-else>
                <div class="mr-1">
                    {{ $t("model.select") }}
                </div>
            </div>
        </template>
        <a-option v-for="p in availableModels" :value="p.providerId + '|' + p.modelId">
            <div class="flex items-center">
                <div class="mr-1">
                    <a-avatar
                        :image-url="getModelLogo(p.modelId)"
                        :size="20"
                        shape="square"
                        style="border: 1px solid #ccc"
                    />
                </div>
                <div class="mr-1">
                    {{ p.providerTitle }}
                </div>
                <div class="mr-1 text-gray-400">/</div>
                <div>
                    {{ p.modelName }}
                </div>
            </div>
        </a-option>
    </a-select>
</template>
