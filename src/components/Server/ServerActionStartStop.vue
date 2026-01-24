<script setup lang="ts">
import {useServerStore} from "../../store/modules/server";
import {EnumServerStatus, ServerRecord} from "../../types/Server";

const serverStore = useServerStore();

const props = defineProps<{
    record: ServerRecord;
}>();

const doStart = async () => {
    const record = props.record;
    await serverStore.start(record);
};
const doStop = async () => {
    const record = props.record;
    await serverStore.stop(record);
};
</script>

<template>
    <a-tooltip :content="$t('service.start')" mini>
        <a-button
            class="mr-2"
            v-if="
                record.status === EnumServerStatus.STOPPED ||
                record.status === EnumServerStatus.STARTING ||
                record.status === EnumServerStatus.ERROR
            "
            :loading="record.status === EnumServerStatus.STARTING"
            type="primary"
            status="success"
            @click="doStart()"
        >
            <template #icon>
                <icon-play-arrow />
            </template>
        </a-button>
    </a-tooltip>
    <a-tooltip :content="$t('common.stopService')" mini>
        <a-button
            class="mr-2"
            v-if="record.status === EnumServerStatus.RUNNING || record.status === EnumServerStatus.STOPPING"
            :loading="record.status === EnumServerStatus.STOPPING"
            type="primary"
            status="danger"
            @click="doStop()"
        >
            <template #icon>
                <icon-pause />
            </template>
        </a-button>
    </a-tooltip>
</template>
