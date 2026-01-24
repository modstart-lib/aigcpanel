<script setup lang="ts">
import FileLogViewer from "../components/common/FileLogViewer.vue";
import {ref} from "vue";

const file = ref('')
const autoScroll = ref(true);
const doOpen = async () => {
    window.$mapi.app.showItemInFolder(file.value);
};
window['__logInit'] = (option: { log: string }) => {
    file.value = option.log;
};
</script>

<template>
    <div style="height:calc(100vh - 2.5rem);" class="flex flex-col">
        <div class="flex p-2 items-center">
            <div class="mr-2">
                <a-checkbox v-model="autoScroll"/>
                {{ $t('log.autoScroll') }}
            </div>
            <div class="mr-1">
                <a-button @click="doOpen" size="mini">
                    <template #icon>
                        <icon-file/>
                    </template>
                    {{ $t('common.openFile') }}
                </a-button>
            </div>
            <div class="text-gray-400 text-xs">
                {{ file }}
            </div>
        </div>
        <div class="flex-grow overflow-hidden relative bg-black">
            <FileLogViewer v-if="!!file" :file="file" :is-data-path="false" :auto-scroll="autoScroll"/>
            <div v-else>
                <div class="text-center py-20 text-gray-300">
                    <div>
                        <icon-info-circle class="text-5xl"/>
                    </div>
                    <div>
                        {{ $t('empty.noLogFile') }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>
