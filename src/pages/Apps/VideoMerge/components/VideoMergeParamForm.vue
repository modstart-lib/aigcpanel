<script setup lang="ts">
import { ref } from "vue";
import { t } from "../../../../lang";

const formData = ref({
    transitionEffect: "none" as string,
    transitionDuration: 500 as number,
});

type VideoMergeForm = {
    transitionEffect: string;
    transitionDuration: number;
};

const transitionOptions = [
    { value: "none", labelKey: "app.transitionNone" },
    { value: "fade", labelKey: "app.transitionFade" },
    { value: "wipeleft", labelKey: "app.transitionWipeLeft" },
    { value: "wiperight", labelKey: "app.transitionWipeRight" },
    { value: "slideleft", labelKey: "app.transitionSlideLeft" },
    { value: "slideright", labelKey: "app.transitionSlideRight" },
    { value: "dissolve", labelKey: "app.transitionDissolve" },
];

const getValue = async (): Promise<VideoMergeForm | undefined> => {
    const data: any = {};
    data.transitionEffect = formData.value.transitionEffect;
    data.transitionDuration = formData.value.transitionDuration;
    return data;
};

const setValue = (data: Partial<VideoMergeForm>) => {
    if (data.transitionEffect !== undefined) {
        formData.value.transitionEffect = data.transitionEffect;
    }
    if (data.transitionDuration !== undefined) {
        formData.value.transitionDuration = data.transitionDuration;
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
            <a-tooltip :content="t('app.transitionEffect')" mini>
                <icon-play-arrow />
                {{ t("app.transitionEffect") }}
            </a-tooltip>
        </div>
        <div class="flex items-center gap-2">
            <a-select v-model="formData.transitionEffect" style="width: 120px">
                <a-option
                    v-for="option in transitionOptions"
                    :key="option.value"
                    :value="option.value"
                >
                    {{ t(option.labelKey) }}
                </a-option>
            </a-select>
        </div>
    </div>
    <div
        v-if="formData.transitionEffect && formData.transitionEffect !== 'none'"
        class="mb-4 flex items-start"
    >
        <div class="pt-1 w-32">
            <a-tooltip :content="t('app.transitionDuration')" mini>
                <icon-clock-circle />
                {{ t("app.transitionDuration") }}
            </a-tooltip>
        </div>
        <div class="flex items-center gap-2">
            <a-input-number
                v-model="formData.transitionDuration"
                :min="100"
                :max="5000"
                :step="100"
                suffix="ms"
                style="width: 120px"
            />
            ms
        </div>
    </div>
</template>
