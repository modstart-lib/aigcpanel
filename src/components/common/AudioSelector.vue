<script setup lang="ts">
import { t } from "../../lang";
import { doOpenFile } from "./util";
import { computed, watch } from "vue";
import { FileUtil } from "../../lib/file";
import AudioPlayerButton from "./AudioPlayerButton.vue";
import { useTruncated } from "./useTruncated";

const props = defineProps<{
    modelValue: string;
    extensions: string[];
}>();
const emit = defineEmits<{
    "update:modelValue": [string];
}>();

const AUDIO_EXTS = [
    "mp3",
    "wav",
    "flac",
    "ogg",
    "aac",
    "m4a",
    "wma",
    "opus",
    "wv",
    "aiff",
];

const effectiveExts = computed(() => {
    if (props.extensions && props.extensions.length > 0) {
        return props.extensions;
    }
    return AUDIO_EXTS;
});

const doSelectFile = async () => {
    const result = await doOpenFile({ extensions: effectiveExts.value });
    if (!result) {
        return;
    }
    emit("update:modelValue", result as string);
};

const doClear = () => {
    emit("update:modelValue", "");
};

const name = computed(() => {
    if (!props.modelValue) return "";
    return FileUtil.getBaseName(props.modelValue, true);
});

// Full button text; ellipsized in narrow cards, full text on hover when cut
const buttonText = computed(() => {
    const label = t("common.selectAudio");
    return `${label} (${t("common.extensions", {
        extensions: effectiveExts.value.join(", "),
    })})`;
});
const { textEl, truncated, check } = useTruncated();
watch(buttonText, () => {
    check();
});
</script>

<template>
    <div class="flex items-center gap-2 min-w-0 w-full">
        <template v-if="modelValue">
            <AudioPlayerButton :source="modelValue" />
            <a-tooltip :content="modelValue" mini>
                <span class="text-sm text-gray-700 truncate max-w-40">
                    {{ name }}
                </span>
            </a-tooltip>
            <a-button size="mini" @click="doClear" class="flex-shrink-0">
                <icon-close />
            </a-button>
            <a-button @click="doSelectFile" size="mini" class="flex-shrink-0">
                {{ t("common.reselect") }}
            </a-button>
        </template>
        <template v-else>
            <a-tooltip :content="buttonText" :disabled="!truncated" mini>
                <a-button
                    @click="doSelectFile"
                    class="max-w-full overflow-hidden"
                >
                    <span
                        class="inline-flex items-center gap-1 min-w-0 max-w-full text-left"
                    >
                        <i-mdi-music-note class="flex-shrink-0" />
                        <span ref="textEl" class="truncate">
                            {{ buttonText }}
                        </span>
                    </span>
                </a-button>
            </a-tooltip>
        </template>
    </div>
</template>
