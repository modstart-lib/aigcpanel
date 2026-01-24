<script setup lang="ts">
import { computed, ref } from 'vue';
import { doCopy } from './common/util';

const props = defineProps({
    text: {
        type: String,
        required: true,
    },
    autoTruncate: {
        type: Boolean,
        default: true,
    },
    maxLength: {
        type: Number,
        default: 100,
    },
    copyable: {
        type: Boolean,
        default: true,
    },
});
const isTruncate = ref(props.autoTruncate);
const showToggle = computed(() => props.text.length > props.maxLength);
const displayText = computed(() => {
    if (isTruncate.value && showToggle.value) {
        return props.text.slice(0, props.maxLength) + '...';
    }
    return props.text;
});

const handleToggle = () => {
    isTruncate.value = !isTruncate.value;
};

const handleCopy = async () => {
    await doCopy(props.text);
};
</script>

<template>
    <div :class="{ 'cursor-pointer': copyable !== false }">
        {{ displayText }}
        <a-tooltip :content='isTruncate ? $t("common.more") : $t("common.collapse")' mini>
            <a-button size="mini" v-if="showToggle" @click="handleToggle">
                <icon-double-down v-if="isTruncate" />
                <icon-double-up v-else />
            </a-button>
        </a-tooltip>
        <a-tooltip v-if="copyable" :content="$t('common.clickToCopy')" mini>
            <a-button size="mini" @click="handleCopy">
                <icon-copy />
            </a-button>
        </a-tooltip>
    </div>
</template>

<style scoped></style>
