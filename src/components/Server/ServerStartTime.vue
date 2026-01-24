<script setup lang="ts">
import {useServerStore} from "../../store/modules/server";
import {EnumServerStatus, ServerRecord} from "../../types/Server";
import {computed, onBeforeUnmount, onMounted, ref} from "vue";
import {TimeUtil} from "../../lib/util";

const serverStore = useServerStore();

const props = defineProps<{
    record: ServerRecord;
}>();
const nowMS = ref(TimeUtil.timestampMS());
let nowMsTimer = null as any;
onMounted(() => {
    nowMsTimer = setInterval(() => {
        nowMS.value = TimeUtil.timestampMS();
    }, 1000);
});
onBeforeUnmount(() => {
    clearInterval(nowMsTimer);
});

const startTime = computed(() => {
    const record = props.record;
    if (record.status === EnumServerStatus.STARTING || record.status === EnumServerStatus.RUNNING) {
        if (record.runtime?.startTimestampMS) {
            const time = nowMS.value - record.runtime?.startTimestampMS;
            return TimeUtil.secondsToTime(time / 1000);
        }
    }
    return null;
});
</script>

<template>
    <div v-if="startTime" class="text-sm text-gray-400">
        {{ $t("status.startedTime", {time: startTime}) }}
    </div>
</template>
