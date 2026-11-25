<template>
    <div class="flex flex-col rounded overflow-hidden h-full" ref="el">
        <div
            class="flex items-center text-xs pl-2 overflow-hidden h-5 leading-5 bg-gray-300 bg-opacity-40 text-gray-200"
        >
            <VideoIcon class="inline-block mr-2 shrink-0 text-black" />
            <span class="mr-4 shrink-0 text-black">{{ trackItem.name }}</span>
            <span class="mr-4 shrink-0 text-black">{{
                formatTime(trackItem.source.duration * 1000).str
            }}</span>
        </div>
        <div
            ref="container"
            class="overflow-hidden bg-gray-200 bg-opacity-70 flex-1 relative whitespace-nowrap"
            :style="waveStyle"
        >
            <img
                v-for="(item, index) in thumbnails"
                :key="index"
                :src="item"
                alt=""
                class="image-item"
                draggable="false"
            />
        </div>
        <div class="leading-3 pl-2 overflow-hidden h-3 bg-gray-300 relative">
            <div :style="waveStyle" class="absolute" ref="waveRef" />
        </div>
        <Loading v-show="loading || audioLoading" class="pl-10 bg-opacity-50" />
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, PropType, ref } from "vue";
import type { VideoTrackItem } from "../../../../../core/track/item/VideoTrackItem";
import VideoIcon from "../../../../icons/VideoIcon.vue";
import Loading from "../../Loading.vue";
import trackCheckPlaying from "./trackCheckPlaying";
import { useResizeObserver } from "@vueuse/core";
import { formatTime } from "../../../../../core/util";
import WaveSurfer from "wavesurfer.js";
import { WaveOptions } from "../../../../../core/track/config";

const props = defineProps({
    trackItem: {
        type: Object as PropType<VideoTrackItem>,
        default() {
            return {
                showWidth: "0px",
                showLeft: "0px",
            };
        },
    },
});
const container = ref();
const audioLoading = ref(true);
const loading = ref(true);
const waveStyle = computed(() => {
    const { start, end, offsetL, offsetR, frameCount } = props.trackItem;
    const showFrameCount = end - start;
    return {
        transform: `scaleX(${(frameCount / showFrameCount).toFixed(2)})`,
        transformOrigin: "left top",
        left: `-${(offsetL / showFrameCount) * 100}%`,
        right: `-${(offsetR / showFrameCount) * 100}%`,
    };
});
const waveRef = ref<HTMLElement>();
const thumbs = ref<string[]>([]);
let waveSurfer: any = null;

async function initAudio() {
    try {
        // @ts-ignore
        const url = await props.trackItem._raw.getAudioUrl();
        // @ts-ignore
        waveSurfer = WaveSurfer.create({
            container: waveRef.value!,
            url: url!,
            ...WaveOptions,
        });
    } catch (e) {
        // 音轨提取失败时只放弃波形，不影响时间线渲染
        console.error("VideoItem.initAudio", e);
    }
    audioLoading.value = false;
}

async function initVideo() {
    const { name, source, format, frameCount, width, height } = props.trackItem;
    // const thumbnails = await videoDecoder.thumbnails(source);
    // thumbs.value = thumbnails!.map(({img}) => {
    //     return URL.createObjectURL(img);
    // });
    loading.value = false;
}

const el = ref();

const containerWidth = ref<number>(100);

trackCheckPlaying(props);

let observer: any = null;
onMounted(() => {
    initVideo();
    initAudio();
    observer = useResizeObserver(el, (entries) => {
        const entry = entries[0];
        const { width } = entry.contentRect;
        containerWidth.value = width;
    });
});

onBeforeUnmount(() => {
    waveSurfer?.destroy();
    waveSurfer = null;
    observer?.stop();
    // thumbs.value.forEach(item => {
    //     URL.revokeObjectURL(item);
    // });
});

function getUniformSubarray(array, m) {
    // 计算采样间隔
    const interval = array.length / m;
    // 使用顺序采样的方法选取元素
    const subarray: any[] = [];
    for (let i = 0; i < array.length && subarray.length < m; i += interval) {
        // 只有当元素数量还没有达到m时，才添加元素
        subarray.push(array[Math.min(Math.round(i), array.length - 1)]);
    }
    return subarray;
}

const thumbnails = computed(() => {
    if (thumbs.value.length === 0) return [];
    const { start, end, offsetL, offsetR, frameCount } = props.trackItem;
    const showFrameCount = end - start;
    return getUniformSubarray(
        thumbs.value,
        Math.ceil((containerWidth.value * frameCount) / showFrameCount / 50),
    );
});
</script>

<style scope>
.image-item {
    display: inline-block;
    width: 50px;
    object-fit: cover;
    height: 100%;
}
</style>
