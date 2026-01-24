<script setup lang="ts">
import {onMounted, ref} from "vue";
import {StorageRecord, StorageService} from "../../../service/StorageService";
import SoundPromptEditDialog from "./SoundPromptEditDialog.vue";
import InputInlineEditor from "../../../components/common/InputInlineEditor.vue";
import AudioPlayer from "../../../components/common/AudioPlayer.vue";
import {Dialog} from "../../../lib/dialog";
import {t} from "../../../lang";

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
    <a-modal v-model:visible="visible" width="900px" :footer="false" title-align="start">
        <template #title>
            <div class="flex items-center">
                <div class="font-bold mr-2">
                    {{ $t("voice.timbreManage") }}
                </div>
                <div class="flex items-center">
                    <a-button @click="editDialog?.add()">
                        <template #icon>
                            <icon-plus />
                        </template>
                        {{ $t("common.add") }}
                    </a-button>
                </div>
            </div>
        </template>
        <div style="height: calc(100vh - 15rem)">
            <m-empty v-if="!records.length && !loading" />
            <m-loading v-else-if="!records.length && loading" page />
            <div v-for="r in records">
                <div class="rounded-xl shadow border p-2 mb-2 hover:shadow-lg">
                    <div class="flex mb-3">
                        <div class="flex-grow w-0 mr-2">
                            <div
                                class="inline-flex max-w-full items-center bg-blue-100 rounded-full px-2 leading-8 h-8"
                            >
                                <div class="truncate overflow-hidden flex-grow cursor-pointer">
                                    {{ r.title }}
                                </div>
                                <InputInlineEditor :value="r.title" @change="onChangeTitle(r, $event)">
                                    <a class="ml-1 text-gray-400" href="javascript:;">
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
                            <a-button @click="doDelete(r)" class="mr-2">
                                <template #icon>
                                    <icon-delete />
                                </template>
                            </a-button>
                        </div>
                    </div>
                    <div class="mb-3">
                        <AudioPlayer show-wave :url="'file://' + r.content.url" />
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
