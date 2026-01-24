<script setup lang="ts">
import {ServerRecord} from "../../types/Server";
import ServerActionInfoDialog from "./ServerActionInfoDialog.vue";
import {ref} from "vue";

const props = defineProps<{
    record: ServerRecord;
}>();
const actionInfoDialog = ref<InstanceType<typeof ServerActionInfoDialog> | null>(null);
</script>

<template>
    <a-tooltip :content="$t('common.info')" mini>
        <a-button class="mr-2" @click="actionInfoDialog?.show()">
            <template #icon>
                <icon-info-circle />
            </template>
        </a-button>
    </a-tooltip>
    <ServerActionInfoDialog :record="props.record" ref="actionInfoDialog" />
</template>
