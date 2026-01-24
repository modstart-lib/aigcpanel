<script setup lang="ts">
import {ServerRecord} from "../../types/Server";
import LogViewerDialog from "../common/LogViewerDialog.vue";
import {computed, ref} from "vue";

const viewerDialog = ref<InstanceType<typeof LogViewerDialog> | null>(null);
const props = defineProps<{
    record: ServerRecord;
}>();

const logFile = computed(() => {
    if (props.record.runtime?.logFile) {
        return props.record.runtime?.logFile;
    }
    return null;
});
</script>

<template>
    <a-tooltip :content="$t('nav.log')" mini>
        <a-button class="mr-2" @click="viewerDialog?.show()" :disabled="!logFile">
            <template #icon>
                <icon-file />
            </template>
        </a-button>
    </a-tooltip>
    <LogViewerDialog ref="viewerDialog" :log-file="logFile" />
</template>
