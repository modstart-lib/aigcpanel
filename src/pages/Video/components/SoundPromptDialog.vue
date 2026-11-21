<script setup lang="ts">
import { onMounted, ref } from "vue";
import { StorageRecord, StorageService } from "../../../service/StorageService";
import SoundPromptEditDialog from "./SoundPromptEditDialog.vue";
import InputInlineEditor from "../../../components/common/InputInlineEditor.vue";
import AudioPlayer from "../../../components/common/AudioPlayer.vue";
import { Dialog } from "../../../lib/dialog";
import { t } from "../../../lang";
import MEmpty from "../../../components/common/MEmpty.vue";
import MLoading from "../../../components/common/MLoading.vue";
import ListerTop from "../../../components/common/ListerTop.vue";

const visible = ref(false);

const editDialog = ref<InstanceType<typeof SoundPromptEditDialog>>();
const records = ref<StorageRecord[]>([]);
const loading = ref(true);
const doRefresh = async () => {
    loading.value = true;
    records.value = await StorageService.list("SoundPrompt");
    loading.value = false;
    emit("update");
};

const onChangeTitle = async (record: StorageRecord, value: string) => {
    await StorageService.update(record.id as any, {
        title: value,
    });
    await doRefresh();
};

const doDelete = async (record: StorageRecord) => {
    await Dialog.confirm(t("common.deleteConfirm"));
    await StorageService.delete(record);
    await doRefresh();
};
const doExport = async (record: StorageRecord) => {
    try {
        const savePath = await window.$mapi.file.openSave({
            defaultPath: record.title + ".wav",
        });
        if (!savePath) return;
        await window.$mapi.file.copy(record.content.url, savePath, {
            isDataPath: false,
        });
        Dialog.tipSuccess(t("sound.exportSuccess"));
    } catch (error) {
        Dialog.tipError(
            t("sound.exportFailed", {
                error: (error as Error).message || error,
            }),
        );
    }
};
const doSelect = (record: StorageRecord) => {
    emit("select", record.id as number);
    visible.value = false;
};
const show = () => {
    visible.value = true;
};
defineExpose({
    show,
});

const emit = defineEmits({
    update: () => true,
    select: (id: number) => true,
});
onMounted(async () => {
    await doRefresh();
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="min(900px, 95vw)"
        :footer="false"
        title-align="start"
    >
        <template #title>
            <div class="font-bold">{{ $t("voice.timbreManage") }}</div>
        </template>
        <div>
            <ListerTop
                :loading="loading"
                :total="records.length"
                @refresh="doRefresh"
            >
                <template #actions>
                    <a-button @click="editDialog?.add()">
                        <template #icon><icon-plus /></template>
                        {{ $t("common.add") }}
                    </a-button>
                </template>
            </ListerTop>
            <m-empty v-if="!records.length && !loading" />
            <m-loading v-else-if="!records.length && loading" page />
            <div v-for="r in records">
                <div class="rounded-xl shadow border p-2 mb-2 hover:shadow-lg">
                    <div class="flex mb-3">
                        <div class="flex-grow w-0 mr-2">
                            <div
                                class="inline-flex max-w-full items-center bg-blue-100 rounded-full px-2 leading-8 h-8"
                            >
                                <div
                                    class="truncate overflow-hidden flex-grow cursor-pointer"
                                >
                                    {{ r.title }}
                                </div>
                                <InputInlineEditor
                                    :value="r.title"
                                    @change="onChangeTitle(r, $event)"
                                >
                                    <a
                                        class="ml-1 text-gray-400"
                                        href="javascript:;"
                                    >
                                        <icon-pen />
                                    </a>
                                </InputInlineEditor>
                            </div>
                        </div>
                        <div>
                            <a-button @click="doSelect(r)" class="mr-2">
                                <template #icon>
                                    <icon-check />
                                </template>
                            </a-button>
                            <a-button @click="doExport(r)" class="mr-2">
                                <template #icon>
                                    <icon-export />
                                </template>
                            </a-button>
                            <a-button @click="doDelete(r)" class="mr-2">
                                <template #icon>
                                    <icon-delete />
                                </template>
                            </a-button>
                        </div>
                    </div>
                    <div class="mb-3">
                        <AudioPlayer
                            show-wave
                            :url="'file://' + r.content.url"
                        />
                    </div>
                    <div>
                        {{ r.content.promptText }}
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
    <SoundPromptEditDialog ref="editDialog" @update="doRefresh" />
</template>
