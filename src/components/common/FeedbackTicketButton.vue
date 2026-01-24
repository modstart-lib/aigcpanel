<script setup lang="ts">
import {AppConfig} from "../../config";

const doShow = () => {
    window.$mapi.app.windowOpen("feedback");
};
</script>

<template>
    <a-button v-if="!!AppConfig.feedbackUrl" size="mini" @click="doShow">
        <template #icon>
            <icon-customer-service />
        </template>
        {{ $t("nav.feedback") }}
    </a-button>
</template>
