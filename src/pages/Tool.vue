<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import Router from "../router";
import {ToolApps} from "./Apps/all";

const tab = ref("");

onMounted(() => {
    tab.value = (Router.currentRoute.value.query.tab as string) || "TextToImage";
});

const dynamicComponent = computed(() => {
    for (const app of ToolApps) {
        if (app.name === tab.value) {
            return app.component;
        }
    }
    return null;
});
</script>

<template>
    <div class="pb-device-container bg-white h-full relative select-none flex">
        <div class="p-4 w-max-52 flex-shrink-0 border-r border-solid border-gray-100 overflow-x-hidden overflow-y-auto">
            <div
                v-for="s in ToolApps"
                class="p-2 rounded-lg mb-4 cursor-pointer"
                :class="tab === s.name ? 'bg-gray-200' : ''"
                @click="tab = s.name"
            >
                <div class="text-base truncate flex items-center">
                    <img :src="s.icon" class="w-4 h-4 mr-2 object-contain"/>
                    {{ s.title }}
                </div>
            </div>
        </div>
        <div class="flex-grow h-full overflow-y-auto">
            <component :is="dynamicComponent"/>
        </div>
    </div>
</template>

<style scoped></style>
