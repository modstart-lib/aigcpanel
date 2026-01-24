<script setup lang="ts">
import {ref} from "vue";
import ModelSetting from "./ModelSetting.vue";

const visible = ref(false);
const show = () => {
    visible.value = true;
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="50rem"
        :footer="false"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
    >
        <template #title>
            {{ $t("setting.llm") }}
        </template>
        <div class="-mx-5 -my-6" style="height: calc(100vh - 15rem)">
            <ModelSetting/>
        </div>
    </a-modal>
</template>
