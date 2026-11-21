<script setup lang="ts">
import { cloneDeep } from "lodash-es";
import { nextTick, ref, watch } from "vue";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import SpeakerSelector from "./SpeakerSelector.vue";
import SoundPromptSelector from "../../pages/Video/components/SoundPromptSelector.vue";
import FileSelector from "./FileSelector.vue";
import AudioSelector from "./AudioSelector.vue";
import IconShuffle from "~icons/mdi/shuffle";
import IconCog from "~icons/mdi/cog";

// param 定义中的 icon 支持 mdi:xxx 格式，映射到 unplugin-icons 组件
const iconMap: Record<string, any> = {
    "mdi:shuffle": IconShuffle,
    "mdi:cog": IconCog,
};

type FieldBasicType = {
    name: string;
    title: string;
    icon: string;
    type:
        | "select"
        | "input"
        | "textarea"
        | "inputNumber"
        | "switch"
        | "slider"
        | "speaker"
        | "file"
        | "audio";
    defaultValue: any;
    placeholder: string;
    required: boolean;
    tips: string;
    min?: number;
    max?: number;
    step?: number;
    sliderMarks?: any;
    options?: Array<{
        value: string;
        label: string;
    }>;
    // file 类型：允许选择的文件扩展名（如 ["png","jpg"]），空数组不限
    extensions?: string[];
    opt?: ("randomValue" | "seed")[];
};

type FieldBasicModelType = FieldBasicType & {
    value: any;
};

const props = defineProps({
    param: Array<FieldBasicType>,
    disabled: {
        type: Boolean,
        default: false,
    },
});
const formData = ref<Array<FieldBasicModelType>>([]);
watch(
    () => props.param,
    (value) => {
        formData.value = (value?.map((item) => {
            const itemClone = cloneDeep(item);
            // if (itemClone.type === "speaker") {
            //     itemClone["speakerParam"] = [];
            //     itemClone["speakerParamValue"] = {};
            // }
            let value = itemClone.defaultValue;
            if (item.opt) {
                if (item.opt.includes("randomValue")) {
                    if (item.type === "inputNumber") {
                        const min = item.min || 0;
                        const max = item.max || 1000000;
                        value =
                            Math.floor(Math.random() * (max - min + 1)) + min;
                    }
                }
            }
            if (typeof value === "undefined") {
                value = null;
            }
            return {
                ...itemClone,
                value: value,
            };
        }) || []) as any;
    },
    {
        immediate: true,
        deep: true,
    },
);
watch(
    () => formData.value,
    () => {
        nextTick(() => {
            emit("change", getValue());
        });
    },
    { immediate: false, deep: true },
);

const getValue = () => {
    const result = {};
    formData.value.forEach((item) => {
        result[item.name] = item.value;
        result["_" + item.name] = item.title;
        if (item.type === "speaker") {
            // for (const k in item["speakerParamValue"]) {
            //     result[k] = item["speakerParamValue"][k];
            // }
            result[`__${item.name}`] = item["speaker"]?.["title"] || item.value;
        }
    });
    return result;
};

const setValue = (value) => {
    formData.value.forEach((item) => {
        item.value = value[item.name] || item.defaultValue;
    });
};

const validate = () => {
    for (const item of formData.value) {
        if (item.required) {
            if (!item.value && item.value !== 0 && item.value !== false) {
                Dialog.tipError(t("form.required", { title: item.title }));
                return false;
            }
        }
    }
    return true;
};

const emit = defineEmits(["change"]);

// const onSpeakerDataUpdate = (name, data) => {
//     const {param, speaker} = data;
//     const item = formData.value.find(item => item.name === name);
//     if (item) {
//         item["speaker"] = speaker;
//         item["speakerParam"] = param;
//         const value = {};
//         param.forEach(paramItem => {
//             value[paramItem.name] = null;
//             if (!paramItem.type || paramItem.type === "select") {
//                 if (paramItem.option && paramItem.option.length > 0) {
//                     value[paramItem.name] = paramItem.option[0].value;
//                 }
//             }
//         });
//         item["speakerParamValue"] = value;
//     }
// };

defineExpose({
    getValue,
    setValue,
    validate,
});
</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
        <div
            v-for="item in formData"
            :key="item.name"
            class="flex flex-col gap-1.5 min-w-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 transition-colors hover:border-gray-300 dark:hover:border-gray-600"
            :class="item.type === 'textarea' ? 'col-span-full' : ''"
        >
            <!-- Label row: required mark + icon + title + tips help icon -->
            <div
                class="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 leading-5 min-w-0"
            >
                <span
                    v-if="item.required"
                    class="text-red-500 flex-shrink-0"
                    aria-hidden="true"
                    >*</span
                >
                <component
                    :is="iconMap[item.icon]"
                    v-if="item.icon && iconMap[item.icon]"
                    class="w-4 h-4 flex-shrink-0"
                    aria-hidden="true"
                />
                <i
                    v-else-if="item.icon"
                    :class="item.icon"
                    class="flex-shrink-0"
                ></i>
                <span class="truncate">{{ item.title }}</span>
                <a-tooltip v-if="item.tips" :content="item.tips" mini>
                    <i-mdi-help-circle-outline
                        class="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0 cursor-help"
                    />
                </a-tooltip>
            </div>
            <div v-if="item.type === 'input'" class="w-full">
                <a-input
                    :placeholder="item.placeholder"
                    allow-clear
                    size="small"
                    :disabled="props.disabled"
                    v-model="item.value"
                    style="width: 100%"
                >
                </a-input>
            </div>
            <div v-else-if="item.type === 'textarea'" class="w-full">
                <a-textarea
                    :placeholder="item.placeholder"
                    :auto-size="{ minRows: 2, maxRows: 6 }"
                    allow-clear
                    size="small"
                    style="width: 100%"
                    :disabled="props.disabled"
                    v-model="item.value"
                >
                </a-textarea>
            </div>
            <div v-else-if="item.type === 'inputNumber'" class="w-full">
                <div class="flex items-center gap-1 w-full">
                    <a-input-number
                        :placeholder="item.placeholder"
                        size="small"
                        v-model="item.value"
                        :disabled="props.disabled"
                        :min="item.min"
                        :max="item.max"
                        style="width: 100%"
                    >
                    </a-input-number>
                    <a-tooltip
                        v-if="item.opt && item.opt.includes('seed')"
                        :content="$t('model.seedTip')"
                    >
                        <icon-refresh
                            @click="
                                item.value = Math.floor(Math.random() * 1000000)
                            "
                            class="cursor-pointer text-gray-400 w-4 h-4 flex-shrink-0"
                        />
                    </a-tooltip>
                </div>
            </div>
            <div v-else-if="item.type === 'select'" class="w-full">
                <a-select
                    :placeholder="item.placeholder"
                    size="small"
                    style="width: 100%"
                    :disabled="props.disabled"
                    v-model="item.value"
                >
                    <a-option
                        v-for="option in item.options"
                        :key="option.value"
                        :value="option.value"
                    >
                        {{ option.label }}
                    </a-option>
                </a-select>
            </div>
            <div
                v-else-if="item.type === 'switch'"
                class="w-full flex items-center"
            >
                <a-switch
                    v-model="item.value"
                    :disabled="props.disabled"
                    size="small"
                />
            </div>
            <div v-else-if="item.type === 'slider'" class="w-full">
                <a-slider
                    v-model="item.value"
                    :marks="item.sliderMarks"
                    show-tooltip
                    :min="item.min"
                    :max="item.max"
                    :disabled="props.disabled"
                    :step="item.step"
                />
            </div>
            <div v-else-if="item.type === 'speaker'" class="w-full">
                <SpeakerSelector
                    v-model="item.value"
                    :speakers="item['speakers']"
                    :disabled="props.disabled"
                />
                <!-- @on-data-update="onSpeakerDataUpdate(item.name, $event)" -->
            </div>
            <div v-else-if="item.type === 'soundPromptId'" class="w-full">
                <SoundPromptSelector
                    v-model="item.value"
                    :disabled="props.disabled"
                />
            </div>
            <div v-else-if="item.type === 'file'" class="w-full">
                <FileSelector
                    v-model="item.value"
                    :extensions="item.extensions || []"
                />
            </div>
            <div v-else-if="item.type === 'audio'" class="w-full">
                <AudioSelector
                    v-model="item.value"
                    :extensions="item.extensions || []"
                />
            </div>
            <!--
        <div v-for="speakerParam in item['speakerParam']">
            <div v-if="!speakerParam.type || speakerParam.type === 'select'" class="mr-3">
                <a-select size="small" :disabled="props.disabled"
                          v-model="item['speakerParamValue'][speakerParam.name]">
                    <a-option v-for="o in speakerParam.option" :key="o.value" :value="o.value">
                        {{ o.title }}
                    </a-option>
                </a-select>
            </div>
        </div>
        --></div>
    </div>
</template>

<style lang="less" scoped>
:deep(.arco-slider) {
    margin-bottom: 0 !important;

    .arco-slider-mark {
        font-size: 10px !important;
    }
}

:deep(.arco-input-number) {
    width: 100%;

    .arco-input {
        text-align: left;
    }
}
</style>
