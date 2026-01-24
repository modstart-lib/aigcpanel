<script setup lang="ts">
import {onMounted, ref} from "vue";
import {VideoTemplateRecord, VideoTemplateService} from "../../../service/VideoTemplateService";

const records = ref<VideoTemplateRecord[]>([]);
onMounted(async () => {
    records.value = await VideoTemplateService.list();
});
</script>

<template>
    <a-select allow-search>
        <a-option :value="0">
            {{ $t("hint.selectAvatar") }}
        </a-option>
        <a-option v-for="record in records" :key="record.id" :value="record.id">
            {{ record.name }}
        </a-option>
    </a-select>
</template>
