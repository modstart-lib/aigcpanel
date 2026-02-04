<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch, watchEffect} from "vue";
import WaveSurfer from "wavesurfer.js";
import RecordPlugin from "wavesurfer.js/dist/plugins/record.esm.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import {AudioUtil} from "../../lib/audio";
import {Dialog} from "../../lib/dialog";
import {TimeUtil} from "../../lib/util";

const props = withDefaults(
    defineProps<{
        url?: string;
        recordEnable?: boolean;
        trimEnable?: boolean;
        downloadEnable?: boolean;
        showWave?: boolean;
    }>(),
    {
        url: "",
        recordEnable: false,
        trimEnable: false,
        downloadEnable: false,
        showWave: false,
    }
);

// 波形相关
const wave = ref<WaveSurfer | null>(null);
const waveContainer = ref(null);
const waveUrl = ref<string | null>(null);
const waveUrlSource = ref<"url" | "trim" | "record" | null>(null);
const waveVisible = ref(false);
const waveLoadAutoPlay = ref(false);
const waveIsLoaded = ref(false);
const waveRecord = ref<any>(null);

const trimUrl = ref<string | null>(null);

const isPlaying = ref(false);
const isTrimming = ref(false);

const recordUrl = ref<string | null>(null);
const isRecording = ref(false);
const recordInputDeviceSelect = ref(null);
const recordInputDevices = ref<{ id: string; name: string }[]>([]);
const recordVisible = ref(false);

const timeTotal = ref<number>(0);
const timeCurrent = ref<number>(0);
let regions = RegionsPlugin.create();
regions.enableDragSelection({
    color: "rgba(255, 0, 0, 0.1)",
});

const timeTotalSecond = computed(() => {
    return Math.round(timeTotal.value);
});
const timeCurrentSecond = computed(() => {
    return Math.round(timeCurrent.value);
});
const timeTotalFormat = computed(() => {
    return TimeUtil.secondsToTime(timeTotalSecond.value);
});
const timeCurrentFormat = computed(() => {
    return TimeUtil.secondsToTime(timeCurrentSecond.value);
});
const isAudioEmpty = computed(() => {
    return !props.url && !trimUrl.value && !recordUrl.value;
});
const debugInfo = computed(() => {
    return {
        waveUrl: waveUrl.value,
        waveUrlSource: waveUrlSource.value,
        waveIsLoaded: waveIsLoaded.value,
    };
});

onMounted(() => {
    wave.value = WaveSurfer.create({
        container: waveContainer.value as any,
        waveColor: "#4A90E2",
        progressColor: "#FF5733",
        cursorColor: "#333",
        barWidth: 2,
        height: 40,
        plugins: [regions],
        autoplay: false,
        cursorWidth: 0,
        sampleRate: 16000,
    });
    waveRecord.value = wave.value.registerPlugin(
        RecordPlugin.create({
            scrollingWaveform: false,
            renderRecordedAudio: false,
        })
    );
    waveRecord.value.on("record-end", blob => {
        recordUrl.value = URL.createObjectURL(blob);
    });
    wave.value.on("play", () => {
        isPlaying.value = true;
        waveVisible.value = true;
    });
    wave.value.on("pause", () => {
        isPlaying.value = false;
    });
    wave.value.on("finish", () => {
        isPlaying.value = false;
    });
    wave.value.on("interaction", () => {
        wave.value?.play();
    });
    wave.value.on("ready", () => {
        if (isAudioEmpty.value) {
            return;
        }
        waveIsLoaded.value = true;
        timeTotal.value = wave.value?.getDuration() as number;
        if (waveLoadAutoPlay.value) {
            wave.value?.play();
            waveLoadAutoPlay.value = false;
        }
    });
    wave.value.on("timeupdate", () => {
        timeCurrent.value = wave.value?.getCurrentTime() as number;
    });
    if (props.recordEnable) {
        if (!props.url) {
            recordVisible.value = true;
        }
        RecordPlugin.getAvailableAudioDevices().then(devices => {
            recordInputDevices.value = devices.map(device => {
                return {
                    id: device.deviceId,
                    name: device.label || device.deviceI,
                };
            });
            if (!recordInputDeviceSelect.value) {
                if (devices.length > 0) {
                    recordInputDeviceSelect.value = devices[0].deviceId;
                }
            }
        });
    }
});

onBeforeUnmount(() => {
    if (wave.value) {
        wave.value.destroy();
    }
});

watch(
    () => props.url,
    url => {
        if (url) {
            // auto add file:// when url is local file
            if (url.startsWith("file:") || url.startsWith("http:") || url.startsWith("https:")) {
            } else {
                url = `file://${url}`;
            }
            waveUrl.value = url;
            waveUrlSource.value = "url";
        }
    },
    {
        immediate: true,
    }
);
watch(
    () => trimUrl.value,
    url => {
        if (url) {
            waveUrl.value = url;
            waveUrlSource.value = "trim";
        }
    },
    {
        immediate: true,
    }
);
watch(
    () => recordUrl.value,
    url => {
        if (url) {
            waveUrl.value = url;
            waveUrlSource.value = "record";
        }
    },
    {
        immediate: true,
    }
);
watchEffect(() => {
    if (wave.value && waveUrl.value) {
        waveIsLoaded.value = false;
        wave.value.load(waveUrl.value);
    }
});

const doPlay = () => {
    if (!waveUrl.value) {
        return;
    }
    if (!waveIsLoaded.value) {
        waveLoadAutoPlay.value = true;
        wave.value?.load(waveUrl.value);
        return;
    }
    wave.value?.play();
};
const doPause = () => {
    wave.value?.pause();
};
const onSeek = (value: number) => {
    wave.value?.seekTo(value / timeTotal.value);
};

const doTrimSave = async () => {
    if (!isTrimming.value) {
        return;
    }
    const region = regions.getRegions()[0];
    const buffer = AudioUtil.audioBufferCut(wave.value?.getDecodedData() as AudioBuffer, region.start, region.end);
    isTrimming.value = false;
    regions.clearRegions();
    wave.value?.empty();
    trimUrl.value = URL.createObjectURL(AudioUtil.audioBufferToWavBlob(buffer));
};

const doTrim = async () => {
    if (!waveUrl.value) {
        return;
    }
    let start = 1;
    let end = timeTotal.value - 1;
    if (end <= start) {
        start = 0;
        end = timeTotal.value;
    }
    regions.clearRegions();
    regions.addRegion({
        start,
        end,
        color: "rgba(255, 255, 0, 0.1)",
        drag: true,
        resize: true,
    });
    isTrimming.value = true;
    waveVisible.value = true;
};

const doDownload = () => {
    if (!waveUrl.value) {
        return;
    }
    const a = document.createElement("a");
    a.href = waveUrl.value;
    a.download = "audio.wav";
    a.click();
};

const doRecord = () => {
    recordVisible.value = true;
};

const doRecordStart = async () => {
    if (waveRecord.value.isRecording() || waveRecord.value.isPaused()) {
        waveRecord.value.stopRecording();
        return;
    }
    try {
        await waveRecord.value.startRecording({ deviceId: recordInputDeviceSelect.value });
        isRecording.value = true;
        waveVisible.value = true;
    } catch (e) {
        Dialog.tipError(`${e}`);
    }
};

const doRecordStop = async () => {
    if (waveRecord.value.isRecording() || waveRecord.value.isPaused()) {
        await waveRecord.value.stopRecording();
        isRecording.value = false;
    }
    recordVisible.value = false;
};

const doRecordBack = async () => {
    recordVisible.value = false;
};

const doRecordClean = async () => {
    recordVisible.value = true;
};

const setRecordFromFile = async (file: File) => {
    recordUrl.value = URL.createObjectURL(file);
    recordVisible.value = false;
};

const getAudioBuffer = () => {
    return wave.value?.getDecodedData() as AudioBuffer;
};

defineExpose({
    setRecordFromFile,
    getAudioBuffer,
});
</script>

<template>
    <div class="border rounded-lg py-2">
        <pre v-if="0" style="white-space: wrap; font-size: 10px">{{ JSON.stringify(debugInfo, null, 2) }}</pre>
        <div class="px-2 overflow-hidden" :style="(isRecording || isTrimming || (showWave && !recordVisible)) && waveVisible
            ? 'height:40px;'
            : 'height:0;'
            ">
            <div ref="waveContainer" style="height: 40px" class="w-full overflow-hidden"></div>
        </div>
        <div v-if="!recordVisible && waveUrl" class="h-10 px-2 flex items-center">
            <div>
                <div v-if="!isPlaying" @click="doPlay" class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-play-circle class="m-auto text-gray-700 hover:text-primary text-2xl" />
                </div>
                <div v-if="isPlaying" @click="doPause" class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-pause-circle class="m-auto text-gray-700 hover:text-primary text-2xl" />
                </div>
            </div>
            <div class="ml-3 text-gray-500 w-24 text-sm font-mono">
                {{ timeCurrentFormat + "/" + timeTotalFormat }}
            </div>
            <div class="ml-3 flex-grow">
                <a-slider :model-value="timeCurrent" :max="timeTotal" @change="onSeek as any" :show-tooltip="false"
                    :step="0.001" :min="0" />
            </div>
            <div class="ml-3">
                <a-tooltip :content="$t('common.collapse')" mini v-if="showWave && waveVisible && !isTrimming && !isRecording">
                    <div @click="waveVisible = false" class="cursor-pointer w-8 h-8 inline-flex">
                        <icon-up class="m-auto text-gray-700 hover:text-primary text-2xl" />
                    </div>
                </a-tooltip>
                <a-tooltip :content="$t('voice.rerecord')" mini v-if="recordUrl && !isTrimming">
                    <div @click="doRecordClean" class="cursor-pointer w-8 h-8 inline-flex">
                        <i class="iconfont icon-refresh-circle m-auto text-gray-700 hover:text-primary text-2xl"></i>
                    </div>
                </a-tooltip>
                <a-tooltip :content="$t('media.cropAudio')" mini v-if="!isTrimming && props.trimEnable">
                    <div @click="doTrim" class="cursor-pointer w-8 h-8 inline-flex">
                        <i class="iconfont icon-cut m-auto text-gray-700 hover:text-primary text-2xl"></i>
                    </div>
                </a-tooltip>
                <a-tooltip :content="$t('media.cropConfirm')" mini v-if="isTrimming && props.trimEnable">
                    <div @click="doTrimSave" class="cursor-pointer w-8 h-8 inline-flex">
                        <icon-check class="m-auto text-gray-700 hover:text-primary text-2xl" />
                    </div>
                </a-tooltip>
                <a-tooltip :content="$t('download.audio')" mini v-if="!isTrimming && props.downloadEnable">
                    <div @click="doDownload" class="cursor-pointer w-8 h-8 inline-flex">
                        <icon-download class="m-auto text-gray-700 hover:text-primary text-2xl" />
                    </div>
                </a-tooltip>
                <a-tooltip :content="$t('voice.record')" mini v-if="props.recordEnable && !isTrimming && !recordUrl">
                    <div @click="doRecord" class="cursor-pointer w-8 h-8 inline-flex">
                        <i class="iconfont icon-mic m-auto text-gray-700 hover:text-primary text-2xl"></i>
                    </div>
                </a-tooltip>
            </div>
        </div>
        <div v-if="recordEnable && recordVisible" class="h-10 px-2 flex items-center">
            <div>
                <div v-if="!isRecording && waveUrl" @click="doRecordBack" class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-left class="m-auto text-gray-700 hover:text-primary text-2xl" />
                </div>
                <div v-if="recordInputDevices.length && !isRecording" @click="doRecordStart"
                    class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-record class="m-auto text-red-700 hover:text-primary text-2xl" />
                </div>
                <div v-else-if="recordInputDevices.length" @click="doRecordStop"
                    class="cursor-pointer w-8 h-8 inline-flex">
                    <icon-record-stop class="m-auto text-gray-700 hover:text-primary text-2xl" />
                </div>
            </div>
            <div class="ml-3">
                <div v-if="!recordInputDevices.length" class="text-sm bg-gray-100 h-10 leading-10 rounded-lg px-5">
                    <icon-info-circle />
                    {{ $t("error.noMicrophone") }}
                </div>
                <a-select v-else v-model="recordInputDeviceSelect as any" size="mini" style="width: 100%">
                    <a-option v-for="device in recordInputDevices" :key="device.id" :value="device.id">
                        {{ device.name }}
                    </a-option>
                </a-select>
            </div>
        </div>
    </div>
</template>

<style scoped></style>
