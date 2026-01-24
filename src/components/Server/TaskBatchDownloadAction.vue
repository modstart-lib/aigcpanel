<script setup lang="ts">
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {TaskRecord} from "../../service/TaskService";
import {computed} from "vue";
import {sleep} from "../../lib/util";
import {mapError} from "../../lib/error";

const props = defineProps<{
    records: TaskRecord[];
}>();

const canDownload = computed(() => {
    return props.records.filter(record => record.status === "success").length > 0;
});

const doDownload = async () => {
    const recordsDownload = props.records.filter(record => record.status === "success");
    if (recordsDownload.length === 0) {
        Dialog.tipError(t("empty.noDownloadRecord"));
        return;
    }
    const pathDir = await window.$mapi.file.openDirectory();
    if (!pathDir) {
        return;
    }
    Dialog.loadingOn(t("status.downloading"));
    let errors: any = [];
    for (const r of recordsDownload) {
        Dialog.loadingUpdate(
            t("status.downloadingProgress", {
                index: recordsDownload.indexOf(r) + 1,
                total: recordsDownload.length,
            })
        );
        let fromPath = r.result.url;
        let targetPath: string = "";
        const fileExt = await window.$mapi.file.ext(fromPath);
        targetPath = `${pathDir}/${r.title}.${fileExt}`;
        await sleep(100);
        if (
            await window.$mapi.file.exists(targetPath, {
                isDataPath: false,
            })
        ) {
            continue;
        }
        try {
            await window.$mapi.file.copy(fromPath, targetPath, {
                isDataPath: false,
            });
        } catch (e) {
            errors.push(mapError(e));
        }
    }
    Dialog.loadingOff();
    if (errors.length > 0) {
        Dialog.tipError(t("common.downloadFailed") + "\n" + errors.join("\n"));
        return;
    }
    Dialog.tipSuccess(t("common.downloadSuccess"));
};
</script>

<template>
    <a-tooltip :content="$t('common.download')" mini>
        <a-button class="mr-2" :disabled="!canDownload" @click="doDownload()">
            <template #icon>
                <icon-download />
            </template>
        </a-button>
    </a-tooltip>
</template>
