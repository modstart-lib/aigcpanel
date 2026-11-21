<script setup lang="ts">
import { ref } from "vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";

const formData = ref({
    normalizationPercentage: 100,
});

type AudioNormalForm = {
    normalizationPercentage: number;
};

const percentagePresets = [
    { label: "25%", value: 25 },
    { label: "50%", value: 50 },
    { label: "75%", value: 75 },
    { label: "100%", value: 100 },
];
const getValue = async (): Promise<AudioNormalForm | undefined> => {
    const data: any = {};
    data.normalizationPercentage = formData.value.normalizationPercentage;
    if (
        data.normalizationPercentage < 0 ||
        data.normalizationPercentage > 100 ||
        isNaN(data.normalizationPercentage)
    ) {
        Dialog.tipError(t("error.validNormalizationPercentage"));
        return;
    }
    return data;
};

const setValue = (data: Partial<AudioNormalForm>) => {
    if (data.normalizationPercentage !== undefined) {
        formData.value.normalizationPercentage = data.normalizationPercentage;
    }
};

defineExpose({
    getValue,
    setValue,
});
</script>

<template>
    <div class="mb-4 flex items-start">
        <div class="pt-1 w-32">
            <a-tooltip :content="t('app.normalizationLevel')" mini>
                <icon-sound />
                {{ t("app.normalizationLevel") }}
            </a-tooltip>
        </div>
        <div class="flex items-center gap-2">
            <a-slider
                v-model="formData.normalizationPercentage"
                :min="0"
                :max="100"
                :step="1"
                :style="{ width: '200px' }"
            />
            <div class="flex gap-1">
                <a-button
                    v-for="preset in percentagePresets"
                    :key="preset.value"
                    size="mini"
                    class="px-1"
                    :type="
                        formData.normalizationPercentage === preset.value
                            ? 'primary'
                            : 'outline'
                    "
                    @click="formData.normalizationPercentage = preset.value"
                >
                    {{ preset.label }}
                </a-button>
            </div>
        </div>
    </div>
</template>
