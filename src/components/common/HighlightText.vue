<script setup lang="ts">
import { computed } from "vue";
import {
    highlightSegments,
    keywordRanges,
    type HighlightRange,
    type HighlightSegment,
} from "../../lib/highlight";

const props = withDefaults(
    defineProps<{
        text?: string | null;
        /** Highlight every occurrence of this keyword. */
        keyword?: string;
        /** Pre-computed ranges; takes precedence over `keyword`. */
        ranges?: HighlightRange[];
        hitClass?: string;
    }>(),
    {
        text: "",
        keyword: "",
        ranges: () => [],
        hitClass: "text-red-500 font-semibold",
    },
);

// Rendered as text nodes only: the source may come from a remote model server
// or from live chat, so no HTML string is ever produced here.
const segments = computed<HighlightSegment[]>(() => {
    const ranges = props.ranges.length
        ? props.ranges
        : keywordRanges(props.text, props.keyword);
    return highlightSegments(props.text, ranges);
});
</script>

<template>
    <span class="pb-highlight"
        ><span
            v-for="(segment, index) in segments"
            :key="index"
            :class="segment.hit ? hitClass : ''"
            >{{ segment.text }}</span
        ></span
    >
</template>
