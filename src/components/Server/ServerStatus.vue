<script setup lang="ts">
import {EnumServerStatus, ServerRuntime} from "../../types/Server";
import {computed} from "vue";
import {t} from "../../lang";

interface Props {
    status: EnumServerStatus | null;
    autoStart: boolean | null;
    runtime: ServerRuntime;
}

const props = defineProps<Props>();

const statusColor = computed(() => {
    const colorMap = {
        [EnumServerStatus.STOPPED]: "bg-gray-400",
        [EnumServerStatus.STARTING]: "bg-yellow-500",
        [EnumServerStatus.RUNNING]: "bg-green-500",
        [EnumServerStatus.STOPPING]: "bg-yellow-400",
        [EnumServerStatus.ERROR]: "bg-red-500",
    };
    if (props.autoStart) {
        if (props.runtime.autoStartStatus === EnumServerStatus.RUNNING) {
            return colorMap[props.runtime.autoStartStatus as string];
        }
        return "bg-blue-400";
    }
    return colorMap[props.status as string] || "bg-gray-400";
});

const statusText = computed(() => {
    const textMap = {
        [EnumServerStatus.STOPPED]: t("status.stopped"),
        [EnumServerStatus.STARTING]: t("service.starting"),
        [EnumServerStatus.RUNNING]: t("status.running"),
        [EnumServerStatus.STOPPING]: t("common.stopping"),
        [EnumServerStatus.ERROR]: t("common.error"),
    };
    if (props.autoStart) {
        if (props.runtime.autoStartStatus === EnumServerStatus.RUNNING) {
            return textMap[props.runtime.autoStartStatus as string];
        }
        return t("setting.autoStart");
    }
    return textMap[props.status as string] || "Unknown";
});
</script>

<template>
    <div class="text-white px-2 py-1 rounded-full text-sm inline-flex items-center" :class="statusColor">
        <div class="w-2 h-2 rounded-full bg-white mr-2"></div>
        <div>
            {{ statusText }}
        </div>
    </div>
</template>
