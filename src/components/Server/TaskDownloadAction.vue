<script setup lang="ts">
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {TaskRecord} from "../../service/TaskService";
import {computed} from "vue";
import {mapError} from "../../lib/error";
import {FileUtil} from "../../lib/file";

const props = defineProps<{
    record: TaskRecord;
    name?: string;
    title?: string;
}>();

const canDownload = computed(() => {
    if (!props.record) {
        return false;
    }
    return props.record.status === "success" && props.record.result[props.name || 'url'];
});

const doDownload = async () => {
    let fromPath = props.record.result[props.name || "url"];
    const fileExt = FileUtil.getExt(fromPath);
    let filePath = await window.$mapi.file.openSave({
        defaultPath: props.record.title + `.${fileExt}`,
    });
    if (!filePath) {
        return;
    }
    if (!filePath.endsWith(`.${fileExt}`)) {
        filePath = filePath + `.${fileExt}`;
    }
    try {
        await window.$mapi.file.copy(fromPath, filePath, {
            isDataPath: false,
        });
    } catch (e) {
        Dialog.tipError(mapError(e));
        return;
    }
    Dialog.tipSuccess(t("common.downloadSuccess"));
};
</script>

<template>
    <a-tooltip :content="title || $t('common.download')" mini>
        <a-button class="mr-2" :disabled="!canDownload" @click="doDownload()">
            <template #icon>
                <slot name="icon">
                    <icon-download />
                </slot>
            </template>
        </a-button>
    </a-tooltip>
</template>
