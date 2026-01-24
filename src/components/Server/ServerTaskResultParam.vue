<script setup lang="ts">
import {computed} from "vue";

const props = defineProps<{
    record: {
        result: Record<string, any>;
    };
}>();
const deviceName = computed(() => {
    if (props.record.result['DeviceName']) {
        return props.record.result['DeviceName'] + (props.record.result['DeviceMemorySize'] ? ' ' + props.record.result['DeviceMemorySize'] + 'G' : '');
    }
    return '';
});
</script>

<template>
    <div v-if="record.result['Device']" class="text-xs">
        <a-tooltip v-if="record.result['Device']==='cuda'" :content="$t('setting.cudaAcceleration')" mini>
            <div class="bg-green-100 text-green-600 rounded-lg px-1 leading-6 h-6 inline-flex items-center">
                <i class="iconfont icon-cuda"></i>
                <div v-if="deviceName">
                    {{ deviceName }}
                </div>
            </div>
        </a-tooltip>
        <a-tooltip v-else content="CPU" mini>
            <div class="bg-yellow-100 text-yellow-600 rounded-lg px-1 leading-6 h-6 inline-flex items-center">
                <i class="iconfont icon-cpu"></i>
                <div v-if="deviceName">
                    {{ deviceName }}
                </div>
            </div>
        </a-tooltip>
    </div>
</template>
