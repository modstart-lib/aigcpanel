<script setup lang="ts">
import { useServerStore } from "../../store/modules/server";
import { EnumServerStatus, ServerRecord } from "../../types/Server";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { TimeUtil } from "../../lib/util";

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
    // 自启动模型（如 ComfyUI）record.status 恒为 RUNNING 且会随任务被反复拉起/空闲退出，
    // 只有 autoStartStatus 为 RUNNING（服务真正被任务拉起使用中）时才显示启动时间，
    // 否则（空闲/已退出）继续显示读秒无意义。
    if (record.autoStart) {
        if (
            record.runtime?.autoStartStatus !== EnumServerStatus.RUNNING ||
            !record.runtime?.startTimestampMS
        ) {
            return null;
        }
        const time = nowMS.value - record.runtime.startTimestampMS;
        return TimeUtil.secondsToTime(time / 1000);
    }
    // 手动启动模型：状态由启停事件驱动，仅在启动中/运行中且记录到启动时间时显示
    if (
        record.status === EnumServerStatus.STARTING ||
        record.status === EnumServerStatus.RUNNING
    ) {
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
        {{ $t("status.startedTime", { time: startTime }) }}
    </div>
</template>
