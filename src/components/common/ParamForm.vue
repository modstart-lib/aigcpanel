<script setup lang="ts">
import {cloneDeep} from "lodash-es";
import {nextTick, ref, watch} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import SpeakerSelector from "./SpeakerSelector.vue";
import SoundPromptSelector from "../../pages/Sound/components/SoundPromptSelector.vue";

type FieldBasicType = {
    name: string;
    title: string;
    icon: string;
    type: "select"
        | "input"
        | "inputNumber"
        | "switch"
        | "slider"
        | "speaker";
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
    opt?: ('randomValue' | 'seed')[]
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
    value => {
        formData.value = value?.map(item => {
            const itemClone = cloneDeep(item);
            // if (itemClone.type === "speaker") {
            //     itemClone["speakerParam"] = [];
            //     itemClone["speakerParamValue"] = {};
            // }
            let value = itemClone.defaultValue;
            if (item.opt) {
                if (item.opt.includes('randomValue')) {
                    if (item.type === 'inputNumber') {
                        const min = item.min || 0;
                        const max = item.max || 1000000;
                        value = Math.floor(Math.random() * (max - min + 1)) + min;
                    }
                }
            }
            if (typeof value === 'undefined') {
                value = null;
            }
            return {
                ...itemClone,
                value: value,
            };
        }) as any;
    },
    {
        immediate: true,
        deep: true,
    }
);
watch(() => formData.value, () => {
    nextTick(() => {
        emit('change', getValue());
    })
}, {immediate: false, deep: true});

const getValue = () => {
    const result = {};
    formData.value.forEach(item => {
        result[item.name] = item.value;
        result['_' + item.name] = item.title;
        if (item.type === "speaker") {
            // for (const k in item["speakerParamValue"]) {
            //     result[k] = item["speakerParamValue"][k];
            // }
            result[`__${item.name}`] = item["speaker"]?.["title"] || item.value;
        }
    });
    return result;
};

const setValue = value => {
    formData.value.forEach(item => {
        item.value = value[item.name] || item.defaultValue;
    });
};

const validate = () => {
    for (const item of formData.value) {
        if (item.required) {
            if (!item.value && item.value !== 0 && item.value !== false) {
                Dialog.tipError(t('form.required', {title: item.title}));
                return false;
            }
        }
    }
    return true;
};

const emit = defineEmits(['change']);

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
    <div v-for="item in formData" :key="item.name" class="mr-2 mb-2 inline-flex items-center">
        <div class="mr-1">
            <a-popover position="bottom">
                <i v-if="item.icon" :class="item.icon"></i>
                <div v-else>{{ item.title }}</div>
                <template #content>
                    <div v-if="item.tips" class="text-sm">
                        <div class="font-bold mb-2">{{ item.title }}</div>
                        <div class="w-48">{{ item.tips }}</div>
                    </div>
                    <div v-else class="text-sm -my-2">
                        <div class="font-bold mb-2">{{ item.title }}</div>
                    </div>
                </template>
            </a-popover>
        </div>
        <div v-if="item.type === 'input'" class="w-48 mr-3">
            <a-input :placeholder="item.placeholder"
                     allow-clear
                     size="small" :disabled="props.disabled" v-model="item.value">
            </a-input>
        </div>
        <div v-else-if="item.type === 'inputNumber'" class="w-32 mr-3">
            <div class="flex items-center gap-1">
                <a-input-number :placeholder="item.placeholder" size="small"
                                v-model="item.value"
                                :disabled="props.disabled"
                                :min="item.min" :max="item.max">
                </a-input-number>
                <a-tooltip v-if="item.opt && item.opt.includes('seed')"
                           :content="$t('model.seedTip')">
                    <icon-refresh
                        @click="item.value = Math.floor(Math.random() * 1000000)"
                        class="cursor-pointer text-gray-400 w-4 h-4"/>
                </a-tooltip>
            </div>
        </div>
        <div v-else-if="item.type === 'select'" class="mr-3">
            <a-select :placeholder="item.placeholder" size="small" style="width: auto" :disabled="props.disabled"
                      v-model="item.value">
                <a-option v-for="option in item.options" :key="option.value" :value="option.value">
                    {{ option.label }}
                </a-option>
            </a-select>
        </div>
        <div v-else-if="item.type === 'switch'" class="mr-3">
            <a-switch v-model="item.value" :disabled="props.disabled" size="small"/>
        </div>
        <div v-else-if="item.type === 'slider'" class="w-48 mr-3">
            <a-slider v-model="item.value" :marks="item.sliderMarks" show-tooltip :min="item.min" :max="item.max"
                      :disabled="props.disabled" :step="item.step"/>
        </div>
        <div v-else-if="item.type === 'speaker'" class="mr-3">
            <SpeakerSelector v-model="item.value" :speakers="item['speakers']" :disabled="props.disabled"
            />
            <!-- @on-data-update="onSpeakerDataUpdate(item.name, $event)" -->
        </div>
        <div v-else-if="item.type === 'soundPromptId'">
            <SoundPromptSelector v-model="item.value" :disabled="props.disabled"/>
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
        -->
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
    padding-left: 0;
    padding-right: 0;

    .arco-input {
        text-align: center;
    }
}
</style>
