<script setup lang="ts">
import {EnumServerStatus, ServerRecord} from "../../types/Server";
import ServerActionSettingDialog from "./ServerActionSettingDialog.vue";
import {computed, ref} from "vue";

const props = defineProps<{
    record: ServerRecord;
}>();
const actionSettingDialog = ref<InstanceType<typeof ServerActionSettingDialog> | null>(null);
const disabled = computed(() => {
    if (props.record.autoStart) {
        if (props.record.runtime.autoStartStatus === EnumServerStatus.RUNNING) {
            return true;
        }
        return false;
    }
    return props.record.status !== EnumServerStatus.STOPPED && props.record.status !== EnumServerStatus.ERROR;
});
</script>

<template>
    <a-tooltip :content="$t('common.setting')" mini>
        <a-button
            class="mr-2"
            @click="actionSettingDialog?.show()"
            :disabled="disabled"
        >
            <template #icon>
                <icon-settings/>
            </template>
        </a-button>
    </a-tooltip>
    <ServerActionSettingDialog :record="props.record" ref="actionSettingDialog"/>
</template>
