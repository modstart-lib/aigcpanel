<script setup lang="ts">
import { ref } from "vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";

const formData = ref({
    action: "remove" as "keep" | "remove",
});

type VideoKeepPartForm = {
    action: "keep" | "remove";
};

const getValue = async (): Promise<VideoKeepPartForm | undefined> => {
    const data: any = {};
    data.action = formData.value.action;
    if (!data.action) {
        Dialog.tipError(t("error.selectActionType"));
        return;
    }
    return data;
};

const setValue = (data: Partial<VideoKeepPartForm>) => {
    if (data.action !== undefined) {
        formData.value.action = data.action;
    }
};

defineExpose({
    getValue,
    setValue,
});
</script>

<template>
    <div class="mb-4 flex items-start">
        <div class="pt-1 w-5">
            <a-tooltip :content="$t('app.actionType')" mini>
                <icon-settings />
            </a-tooltip>
        </div>
        <div class="flex items-center gap-2">
            <a-radio-group v-model="formData.action">
                <a-radio value="remove">{{
                    $t("app.removeSelectedSegments")
                }}</a-radio>
                <a-radio value="keep">{{
                    $t("app.keepSelectedSegments")
                }}</a-radio>
            </a-radio-group>
        </div>
    </div>
</template>
