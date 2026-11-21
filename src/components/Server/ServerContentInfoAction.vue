<script setup lang="ts">
import { computed, ref } from "vue";
import ServerCloudDemoDialog from "./ServerCloudDemoDialog.vue";
import SafeHtml from "../common/SafeHtml.vue";

const demoDialog = ref<InstanceType<typeof ServerCloudDemoDialog> | null>(null);

const props = defineProps({
    config: {
        type: Object,
        default: () => {
            return null;
        },
    },
    func: {
        type: String,
        default: "",
    },
});
const visible = ref(false);
const content = computed(() => {
    if (!props.config) {
        return "";
    }
    const lines: string[] = [];
    if (props.config.content) {
        lines.push(props.config.content as string);
    }
    if (
        props.func &&
        props.config.functions &&
        props.config.functions[props.func] &&
        props.config.functions[props.func].content
    ) {
        lines.push(props.config.functions[props.func].content as string);
    }
    return lines.join("\n");
});
</script>

<template>
    <a-button v-if="content" class="mr-2" @click="visible = true">
        <icon-info-circle class="mr-1" />
        {{ $t("model.description") }}
    </a-button>
    <a-modal
        v-model:visible="visible"
        width="40rem"
        :footer="false"
        title-align="start"
    >
        <template #title>
            {{ $t("model.description") }}
        </template>
        <div class="overflow-x-hidden leading-6">
            <SafeHtml :html="content" />
        </div>
    </a-modal>
    <a-button
        class="mr-2"
        @click="demoDialog?.show(props.config as any)"
        v-if="config && config.demo && config.demo.length"
    >
        <icon-eye />
        {{ $t("common.viewEffect") }}
    </a-button>
    <ServerCloudDemoDialog ref="demoDialog" />
</template>
