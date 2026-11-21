<script setup lang="ts">
import VoiceManage from "../../components/Voice/VoiceManage.vue";
import { SoundVoiceService } from "../../service/VoiceService";
</script>

<template>
    <VoiceManage
        :service="SoundVoiceService"
        title-key="soundVoice.title"
        desc-key="soundVoice.manage"
        test-prefix="SoundVoice"
    />
</template>
