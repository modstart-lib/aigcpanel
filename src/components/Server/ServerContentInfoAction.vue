<script setup lang="ts">
import {computed, ref, watch} from "vue";
import ServerCloudDemoDialog from "./ServerCloudDemoDialog.vue";
import {doCopy} from "../common/util";

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
watch(
    () => visible.value,
    v => {
        if (v) {
            const codeElements = document.querySelectorAll(".pb-content-info code");
            codeElements.forEach(codeElement => {
                if (codeElement.getAttribute("data-click-bind")) {
                    return;
                }
                codeElement.addEventListener("click", () => {
                    const text = codeElement.textContent || "";
                    doCopy(text);
                });
                codeElement.setAttribute("data-click-bind", "true");
            });
        }
    }
);
</script>

<template>
    <a-button v-if="content" class="mr-2" @click="visible = true">
        <icon-info-circle class="mr-1" />
        {{ $t("model.description") }}
    </a-button>
    <a-modal v-model:visible="visible" width="40rem" :footer="false" title-align="start">
        <template #title>
            {{ $t("model.description") }}
        </template>
        <div class="overflow-y-auto overflow-x-hidden leading-6 pb-content-info" style="max-height: 60vh">
            <div v-html="content"></div>
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

<style lang="less" scoped>
.pb-content-info {
    :deep(code) {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 0.2rem;
        display: inline-block;
        padding: 0.1rem 0.2rem;
        cursor: pointer;
        margin-bottom: 0.2rem;
    }
}
</style>
