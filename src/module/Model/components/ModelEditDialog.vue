<script setup lang="ts">
import { ref } from "vue";
import { useModelStore } from "../store/model";
import {
    Model,
    ModelType,
    modelTypeNormalize,
    modelTypeOptions,
} from "../types";

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
    type: "text" as ModelType,
    caps: {
        vision: false,
        tools: false,
    },
});
const show = (model: Model) => {
    data.value.id = model.id;
    data.value.name = model.name;
    data.value.group = model.group;
    data.value.type = modelTypeNormalize(model.type);
    data.value.caps = {
        vision: model.caps?.vision || false,
        tools: model.caps?.tools || false,
    };
    visible.value = true;
};
const fill = (param: Record<string, any>) => {
    Object.assign(data.value, param);
};
const doSubmit = () => {
    if (!data.value.id) {
        return;
    }
    modelStore.modelEdit(props.provider.id, {
        id: data.value.id,
        name: data.value.name,
        group: data.value.group,
        type: data.value.type,
        caps: data.value.caps,
    });
    visible.value = false;
};
defineExpose({
    show,
    fill,
    doSubmit,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="30rem"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
    >
        <template #title>
            {{ $t("model.edit") }}
        </template>
        <template #footer>
            <a-button @click="visible = false">{{
                $t("common.cancel")
            }}</a-button>
            <a-button type="primary" @click="doSubmit">{{
                $t("common.confirm")
            }}</a-button>
        </template>
        <div>
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
                    <a-input
                        v-model:model-value="data.name"
                        :placeholder="$t('placeholder.gpt35')"
                    />
                </a-form-item>
                <a-form-item :label="$t('group.name')" name="type">
                    <a-input
                        v-model:model-value="data.group"
                        :placeholder="$t('placeholder.chatgpt')"
                    />
                </a-form-item>
                <a-form-item :label="$t('model.type')" name="modelType">
                    <a-radio-group
                        v-model:model-value="data.type"
                        type="button"
                    >
                        <a-radio
                            v-for="o in modelTypeOptions()"
                            :key="o.value"
                            :value="o.value"
                        >
                            {{ o.title }}
                        </a-radio>
                    </a-radio-group>
                </a-form-item>
                <a-form-item :label="$t('model.capability')" name="caps">
                    <div class="flex gap-4">
                        <a-checkbox v-model="data.caps.vision">
                            <template #checkbox-icon>
                                <icon-eye />
                            </template>
                            {{ $t("model.capVision") }}
                        </a-checkbox>
                        <a-checkbox v-model="data.caps.tools">
                            <template #checkbox-icon>
                                <icon-tool />
                            </template>
                            {{ $t("model.capTools") }}
                        </a-checkbox>
                    </div>
                </a-form-item>
            </a-form>
        </div>
    </a-modal>
</template>
