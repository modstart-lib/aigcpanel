<script setup lang="ts">
import ServerNameVersion from "../../../components/Server/ServerNameVersion.vue";
import ParamFormView from "../../../components/common/ParamFormView.vue";

const props = defineProps<{
    data: SoundGenerateParamType;
}>();
</script>

<template>
    <a-tag v-if="data.type === 'SoundTts'" class="rounded-lg">
        <i class="iconfont icon-sound-generate w-5"></i>
        {{ $t("voice.synthesis") }}
    </a-tag>
    <a-tag v-else-if="data.type === 'SoundClone'" class="rounded-lg">
        <i class="iconfont icon-sound-clone w-5"></i>
        {{ $t("voice.clone") }}
    </a-tag>
    <ServerNameVersion v-if="data.serverTitle" :record="data" />
    <a-tag v-if="data.type === 'SoundClone'" class="rounded-lg">
        <i class="iconfont icon-sound-prompt w-5"></i>
        {{ data.promptTitle }}
    </a-tag>
    <ParamFormView v-if="data.type === 'SoundTts' && data.ttsParam" :param="data.ttsParam" />
    <ParamFormView v-else-if="data.type === 'SoundClone' && data.cloneParam" :param="data.cloneParam" />
</template>
