<script setup lang="ts">
import ServerNameVersion from "../../../components/Server/ServerNameVersion.vue";
import ParamFormView from "../../../components/common/ParamFormView.vue";

const props = defineProps<{
    data: any;
}>();
</script>

<template>
    <ServerNameVersion v-if="data.serverTitle" :record="data" />
    <ParamFormView :param="data.param" />
</template>
