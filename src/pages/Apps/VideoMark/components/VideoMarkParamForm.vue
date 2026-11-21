<script setup lang="ts">
import { ref } from "vue";
import { Dialog } from "../../../../lib/dialog";
import { t } from "../../../../lang";

const formData = ref({
    borderColor: "#ff0000",
    borderWidth: 10,
    borderOpacity: 50,
    borderRadius: 10,
    borderStyle: "solid" as "solid" | "dashed",
});

type VideoMarkForm = {
    borderColor: string;
    borderWidth: number;
    borderOpacity: number;
    borderRadius: number;
    borderStyle: "solid" | "dashed";
};

const getValue = async (): Promise<VideoMarkForm | undefined> => {
    const data: any = {};
    data.borderColor = formData.value.borderColor;
    data.borderWidth = formData.value.borderWidth;
    data.borderOpacity = formData.value.borderOpacity / 100; // Convert to 0-1
    data.borderRadius = formData.value.borderRadius;
    data.borderStyle = formData.value.borderStyle;
    if (data.borderWidth <= 0 || isNaN(data.borderWidth)) {
        Dialog.tipError(t("error.validBorderWidth"));
        return;
    }
    if (data.borderOpacity < 0 || data.borderOpacity > 1) {
        Dialog.tipError(t("error.validBorderOpacity"));
        return;
    }
    if (data.borderRadius < 0 || isNaN(data.borderRadius)) {
        Dialog.tipError(t("error.validBorderRadius"));
        return;
    }
    return data;
};

const setValue = (data: Partial<VideoMarkForm>) => {
    if (data.borderColor !== undefined) {
        formData.value.borderColor = data.borderColor;
    }
    if (data.borderWidth !== undefined) {
        formData.value.borderWidth = data.borderWidth;
    }
    if (data.borderOpacity !== undefined) {
        formData.value.borderOpacity = data.borderOpacity * 100; // Convert to 0-100
    }
    if (data.borderRadius !== undefined) {
        formData.value.borderRadius = data.borderRadius;
    }
    if (data.borderStyle !== undefined) {
        formData.value.borderStyle = data.borderStyle;
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
            <a-tooltip :content="$t('app.borderColor')" mini>
                <icon-bg-colors />
                {{ $t("app.borderColor") }}
            </a-tooltip>
        </div>
        <div class="flex-grow">
            <a-color-picker v-model="formData.borderColor" />
        </div>
    </div>
    <div class="mb-4 flex items-start">
        <div class="pt-1 w-32">
            <a-tooltip :content="$t('app.borderWidth')" mini>
                <icon-edit />
                {{ $t("app.borderWidth") }}
            </a-tooltip>
        </div>
        <div class="flex-grow">
            <a-input-number
                v-model="formData.borderWidth"
                :min="1"
                :max="100"
            />
        </div>
    </div>
    <div class="mb-4 flex items-start">
        <div class="pt-1 w-32">
            <a-tooltip :content="$t('app.borderOpacity')" mini>
                <icon-eye />
                {{ $t("app.borderOpacity") }}
            </a-tooltip>
        </div>
        <div class="flex-grow">
            <a-slider
                v-model="formData.borderOpacity"
                :min="0"
                :max="100"
                :step="1"
            />
            <div class="text-sm text-gray-500 mt-1">
                {{ formData.borderOpacity }}%
            </div>
        </div>
    </div>
    <div class="mb-4 flex items-start">
        <div class="pt-1 w-32">
            <a-tooltip :content="$t('app.borderRadius')" mini>
                <icon-settings />
                {{ $t("app.borderRadius") }}
            </a-tooltip>
        </div>
        <div class="flex-grow">
            <a-input-number
                v-model="formData.borderRadius"
                :min="0"
                :max="50"
            />
        </div>
    </div>
    <div class="mb-4 flex items-start">
        <div class="pt-1 w-32">
            <a-tooltip :content="$t('app.borderStyle')" mini>
                <icon-edit />
                {{ $t("app.borderStyle") }}
            </a-tooltip>
        </div>
        <div class="flex-grow">
            <a-radio-group v-model="formData.borderStyle" type="button">
                <a-radio value="solid">{{ $t("app.borderSolid") }}</a-radio>
                <a-radio value="dashed">{{ $t("app.borderDashed") }}</a-radio>
            </a-radio-group>
        </div>
    </div>
</template>
