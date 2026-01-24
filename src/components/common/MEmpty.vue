<template>
    <div class="py-20 text-center text-gray-400 h-full flex">
        <div class="m-auto">
            <div class="text-center">
                <img class="w-20 w-h-20 object-contain m-auto dark:hidden" src="./../../assets/image/no-record.svg" />
                <img
                    class="w-20 w-h-20 object-contain m-auto hidden dark:block"
                    src="./../../assets/image/no-record-dark.svg?12"
                />
            </div>
            <div class="text-center text-sm">
                {{ text || $t("empty.noRecord") }}
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
const props = defineProps<{
    text?: string;
}>();
</script>
