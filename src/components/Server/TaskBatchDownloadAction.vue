<script setup lang="ts">
import { Dialog } from "../../lib/dialog";
import { t } from "../../lang";
import { TaskRecord } from "../../service/TaskService";
import { computed } from "vue";
import { sleep } from "../../lib/util";
import { mapError } from "../../lib/error";
import { planDownloadTargets } from "../../lib/fileName";

const props = defineProps<{
    records: TaskRecord[];
}>();

const canDownload = computed(() => {
    return (
        props.records.filter((record) => record.status === "success").length > 0
    );
});

// The tip already carries the total count, so only a few names are listed
const namesPreview = (names: string[]) => {
    const preview = names.slice(0, 3).join(", ");
    return names.length > 3 ? `${preview} …` : preview;
};

const doDownload = async () => {
    const recordsDownload = props.records.filter(
        (record) => record.status === "success",
    );
    if (recordsDownload.length === 0) {
        Dialog.tipError(t("empty.noDownloadRecord"));
        return;
    }
    const pathDir = await window.$mapi.file.openDirectory();
    if (!pathDir) {
        return;
    }
    Dialog.loadingOn(t("status.downloading"));
    // A title is free text and may contain path separators, so the file name
    // is built from it instead of used as-is; the title in the task list stays
    // untouched. Records sharing a title inside one batch are numbered so none
    // of them is lost, and a file that was already in the folder is reported
    // as skipped instead of producing a plain success.
    const items: { title: string; ext: string }[] = [];
    for (const r of recordsDownload) {
        items.push({
            title: r.title || "",
            ext: await window.$mapi.file.ext(r.result.url),
        });
    }
    const targets = await planDownloadTargets({
        dir: pathDir,
        items,
        exists: (path) =>
            window.$mapi.file.exists(path, {
                isDataPath: false,
            }),
    });
    let errors: any = [];
    const renamedNames: string[] = [];
    const skippedNames: string[] = [];
    for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        Dialog.loadingUpdate(
            t("status.downloadingProgress", {
                index: i + 1,
                total: targets.length,
            }),
        );
        if (target.state === "skipped") {
            skippedNames.push(target.fileName);
            continue;
        }
        if (target.state === "duplicated") {
            renamedNames.push(target.fileName);
        }
        await sleep(100);
        try {
            await window.$mapi.file.copy(
                recordsDownload[i].result.url,
                target.path,
                {
                    isDataPath: false,
                },
            );
        } catch (e) {
            errors.push(mapError(e));
        }
    }
    Dialog.loadingOff();
    const tips: string[] = [];
    if (renamedNames.length > 0) {
        tips.push(
            t("common.downloadRenamed", {
                count: renamedNames.length,
                names: namesPreview(renamedNames),
            }),
        );
    }
    if (skippedNames.length > 0) {
        tips.push(
            t("common.downloadSkipped", {
                count: skippedNames.length,
                names: namesPreview(skippedNames),
            }),
        );
    }
    if (errors.length > 0) {
        Dialog.tipError(
            [t("common.downloadFailed"), errors.join("\n"), ...tips].join("\n"),
        );
        return;
    }
    Dialog.tipSuccess([t("common.downloadSuccess"), ...tips].join("\n"));
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
