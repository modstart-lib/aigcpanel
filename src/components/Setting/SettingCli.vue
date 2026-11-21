<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { t } from "../../lang";
import { testActionSet, testActionUnset } from "../../utils/test";
import MarkdownDocViewer from "../common/MarkdownDocViewer.vue";
import cliDocContent from "../../docs/cli-doc.md?raw";

const platform = window.$mapi.app.platformName() as "win" | "osx" | "linux";

const cliBinPath = ref("");
const symlinkTarget = "/usr/local/bin/aigcpanel";
const localBinTarget = "~/.local/bin/aigcpanel";

const installStatus = ref<"idle" | "loading" | "done" | "error">("idle");
const installMsg = ref("");
const isInstalled = ref(false);
const docVisible = ref(false);

const cliToolsDocs: Array<{ biz: string; title: string; example: string }> = [
    {
        biz: "SoundGenerate",
        title: "语音合成",
        example: `aigcpanel tools --name SoundGenerate --param '{"text":"你好世界"}'`,
    },
    {
        biz: "SoundAsr",
        title: "语音识别",
        example: `aigcpanel tools --name SoundAsr --param '{"file":"/path/to/audio.wav"}'`,
    },
    {
        biz: "VideoGen",
        title: "数字人合成",
        example: `aigcpanel tools --name VideoGen --param '{"text":"欢迎使用"}'`,
    },
    {
        biz: "VideoGenFlow",
        title: "视频生成流",
        example: `aigcpanel tools --name VideoGenFlow --param '{"text":"欢迎使用"}'`,
    },
    {
        biz: "LongTextTts",
        title: "长文本转音频",
        example: `aigcpanel tools --name LongTextTts --param '{"text":"这是一段较长的文本内容"}'`,
    },
    {
        biz: "SubtitleTts",
        title: "字幕转音频",
        example: `aigcpanel tools --name SubtitleTts --param '{"file":"/path/to/subtitle.srt"}'`,
    },
    {
        biz: "SoundReplace",
        title: "声音替换",
        example: `aigcpanel tools --name SoundReplace --param '{"file":"/path/to/video.mp4"}'`,
    },
    {
        biz: "TextToImage",
        title: "文生图",
        example: `aigcpanel tools --name TextToImage --param '{"prompt":"美丽的山水风景"}'`,
    },
    {
        biz: "ImageToImage",
        title: "图生图",
        example: `aigcpanel tools --name ImageToImage --param '{"file":"/path/to/image.png","prompt":"油画风格"}'`,
    },
    {
        biz: "AudioNormal",
        title: "声音归一化",
        example: `aigcpanel tools --name AudioNormal --param '{"file":"/path/to/audio.wav"}'`,
    },
    {
        biz: "Ffmpeg",
        title: "Ffmpeg处理",
        example: `aigcpanel tools --name Ffmpeg --param '{"file":"/path/to/input.mp4"}'`,
    },
    {
        biz: "MediaFormatConvert",
        title: "媒体格式转换",
        example: `aigcpanel tools --name MediaFormatConvert --param '{"file":"/path/to/video.mp4","targetFormat":"mp4"}'`,
    },
    {
        biz: "VideoBackground",
        title: "视频背景",
        example: `aigcpanel tools --name VideoBackground --param '{"file":"/path/to/video.mp4","image":"/path/to/bg.png"}'`,
    },
    {
        biz: "VideoBackgroundReplace",
        title: "更换视频背景",
        example: `aigcpanel tools --name VideoBackgroundReplace --param '{"video":"/path/to/green.mp4","image":"/path/to/bg.png","keyColor":"#00FF00","similarity":0.3,"blend":0.1}'`,
    },
    {
        biz: "VideoCompress",
        title: "视频压缩",
        example: `aigcpanel tools --name VideoCompress --param '{"file":"/path/to/video.mp4"}'`,
    },
    {
        biz: "VideoKeepPart",
        title: "视频片段删除/保留",
        example: `aigcpanel tools --name VideoKeepPart --param '{"file":"/path/to/video.mp4"}'`,
    },
    {
        biz: "VideoMark",
        title: "视频标注",
        example: `aigcpanel tools --name VideoMark --param '{"file":"/path/to/video.mp4"}'`,
    },
    {
        biz: "VideoMerge",
        title: "视频合并",
        example: `aigcpanel tools --name VideoMerge --param '{"file":"/path/to/video1.mp4","file2":"/path/to/video2.mp4"}'`,
    },
    {
        biz: "VideoMergeAudio",
        title: "视频添加音频",
        example: `aigcpanel tools --name VideoMergeAudio --param '{"file":"/path/to/video.mp4","audio":"/path/to/audio.wav"}'`,
    },
    {
        biz: "VideoMergeImage",
        title: "片头片尾图片",
        example: `aigcpanel tools --name VideoMergeImage --param '{"file":"/path/to/video.mp4","image":"/path/to/image.png"}'`,
    },
    {
        biz: "VideoQuickCut",
        title: "快速剪辑",
        example: `aigcpanel tools --name VideoQuickCut --param '{"file":"/path/to/video.mp4"}'`,
    },
    {
        biz: "VideoSizeConvert",
        title: "视频尺寸转换",
        example: `aigcpanel tools --name VideoSizeConvert --param '{"file":"/path/to/video.mp4","targetWidth":1280,"targetHeight":720}'`,
    },
    {
        biz: "VideoSpeed",
        title: "视频变速",
        example: `aigcpanel tools --name VideoSpeed --param '{"file":"/path/to/video.mp4","speed":1.5}'`,
    },
    {
        biz: "VideoSpeedPart",
        title: "视频片段变速",
        example: `aigcpanel tools --name VideoSpeedPart --param '{"file":"/path/to/video.mp4"}'`,
    },
    {
        biz: "VideoSubtitle",
        title: "视频添加字幕",
        example: `aigcpanel tools --name VideoSubtitle --param '{"file":"/path/to/video.mp4","subtitle":"/path/to/subtitle.srt"}'`,
    },
    {
        biz: "VideoZoom",
        title: "视频片段放大",
        example: `aigcpanel tools --name VideoZoom --param '{"file":"/path/to/video.mp4"}'`,
    },
];

onMounted(async () => {
    if (platform !== "win") {
        cliBinPath.value =
            await window.$mapi.app.resourcePathResolve("bin/aigcpanel");
        await checkInstalled();
    } else {
        cliBinPath.value =
            await window.$mapi.app.resourcePathResolve("bin/aigcpanel.exe");
    }
    testActionSet("Setting.setCliPathDemo", (arg?: any) => {
        const home = arg?.home || "/Users/demo";
        cliBinPath.value =
            platform === "win"
                ? `C:\\demo\\aigcpanel\\resources\\bin\\aigcpanel.exe`
                : `${home}/aigcpanel/resources/bin/aigcpanel`;
    });
});
onBeforeUnmount(() => {
    testActionUnset("Setting.setCliPathDemo");
});

async function checkInstalled() {
    try {
        const { stdout } = await window.$mapi.app.shell(
            "which aigcpanel 2>/dev/null || echo ''",
        );
        isInstalled.value = stdout.trim().length > 0;
    } catch {
        isInstalled.value = false;
    }
}

const doInstall = async () => {
    installStatus.value = "loading";
    installMsg.value = "";
    try {
        if (platform === "osx") {
            await window.$mapi.app.shell(
                `osascript -e 'do shell script "ln -sf \\"${cliBinPath.value}\\" ${symlinkTarget}" with administrator privileges'`,
            );
            installMsg.value = t("cli.installedTo", { path: symlinkTarget });
        } else if (platform === "linux") {
            await window.$mapi.app.shell(
                `mkdir -p "$HOME/.local/bin" && ln -sf "${cliBinPath.value}" "$HOME/.local/bin/aigcpanel"`,
            );
            installMsg.value = t("cli.installedTo", {
                path: "~/.local/bin/aigcpanel",
            });
        }
        installStatus.value = "done";
        isInstalled.value = true;
    } catch (e: any) {
        installStatus.value = "error";
        installMsg.value = e.stderr || e.message || t("cli.installFailed");
    }
};
</script>

<template>
    <div>
        <!-- macOS / Linux -->
        <template v-if="platform !== 'win'">
            <div class="flex mb-3">
                <div class="w-24 flex-shrink-0">{{ $t("cli.toolPath") }}</div>
                <div
                    class="flex-grow text-gray-500 break-all text-sm leading-6"
                >
                    {{ cliBinPath || $t("common.loadingDots") }}
                </div>
            </div>
            <div class="flex mb-3">
                <div class="w-24 flex-shrink-0">
                    {{ $t("cli.usageInstructions") }}
                </div>
                <div class="flex-grow">
                    <div class="text-sm text-gray-500 mb-2">
                        {{ $t("cli.usageDesc") }}
                        <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded"
                            >aigcpanel</code
                        >
                    </div>
                    <div
                        class="bg-gray-100 dark:bg-gray-800 rounded p-3 text-sm font-mono space-y-1"
                    >
                        <div class="text-gray-400"># 查看版本</div>
                        <div>aigcpanel version</div>
                        <div class="mt-2 text-gray-400">
                            # 查看已安装模型列表
                        </div>
                        <div>aigcpanel serverList</div>
                        <div class="mt-2 text-gray-400">
                            # 调用工具（以视频压缩为例）
                        </div>
                        <div>
                            aigcpanel tools --name VideoCompress --param
                            '{"file":"/path/to/video.mp4"}'
                        </div>
                        <div class="mt-2 text-gray-400">
                            # 调用工具（以语音合成为例）
                        </div>
                        <div>
                            aigcpanel tools --name SoundGenerate --param
                            '{"text":"你好"}'
                        </div>
                    </div>
                    <div class="mt-3 text-sm text-gray-500">
                        {{ $t("cli.installLocation") }}：
                        <template v-if="platform === 'osx'">
                            <code
                                class="bg-gray-100 dark:bg-gray-700 px-1 rounded"
                                >{{ symlinkTarget }}</code
                            >{{ $t("cli.requiresAdminPassword") }}
                        </template>
                        <template v-else>
                            <code
                                class="bg-gray-100 dark:bg-gray-700 px-1 rounded"
                                >{{ localBinTarget }}</code
                            >
                            <span class="ml-2">{{
                                $t("cli.pathHintLinux")
                            }}</span>
                        </template>
                    </div>
                    <div class="mt-3">
                        <a-button @click="docVisible = true">
                            <template #icon><icon-file /></template>
                            查看完整文档
                        </a-button>
                    </div>
                </div>
            </div>
            <div class="flex mb-3 items-center">
                <div class="w-24 flex-shrink-0">
                    {{ $t("cli.installSection") }}
                </div>
                <div class="flex items-center gap-3">
                    <a-button
                        type="primary"
                        :loading="installStatus === 'loading'"
                        :disabled="!cliBinPath"
                        @click="doInstall"
                    >
                        <template #icon><icon-link /></template>
                        {{
                            isInstalled
                                ? $t("cli.reinstall")
                                : $t("cli.install")
                        }}
                    </a-button>
                    <span
                        v-if="installStatus === 'done'"
                        class="text-green-600 text-sm"
                    >
                        <icon-check-circle /> {{ installMsg }}
                    </span>
                    <span
                        v-else-if="installStatus === 'error'"
                        class="text-red-500 text-sm"
                    >
                        <icon-close-circle /> {{ installMsg }}
                    </span>
                    <span v-else-if="isInstalled" class="text-gray-400 text-sm">
                        <icon-check-circle /> {{ $t("cli.installed") }}
                    </span>
                </div>
            </div>
        </template>

        <!-- Windows -->
        <template v-else>
            <div class="flex mb-3">
                <div class="w-24 flex-shrink-0">{{ $t("cli.toolPath") }}</div>
                <div
                    class="flex-grow text-gray-500 break-all text-sm leading-6"
                >
                    {{ cliBinPath || $t("common.loadingDots") }}
                </div>
            </div>
            <div class="flex mb-3">
                <div class="w-24 flex-shrink-0">
                    {{ $t("cli.usageInstructions") }}
                </div>
                <div class="flex-grow">
                    <div class="text-sm text-gray-500 mb-2">
                        {{ $t("cli.addPathDesc") }}
                    </div>
                    <div
                        class="bg-gray-100 dark:bg-gray-800 rounded p-3 text-sm font-mono space-y-1"
                    >
                        <div class="text-gray-400">:: 查看版本</div>
                        <div>aigcpanel version</div>
                        <div class="mt-2 text-gray-400">
                            :: 查看已安装模型列表
                        </div>
                        <div>aigcpanel serverList</div>
                        <div class="mt-2 text-gray-400">
                            :: 调用工具（以视频压缩为例）
                        </div>
                        <div>
                            aigcpanel tools --name VideoCompress --param
                            '{"file":"C:\\path\\to\\video.mp4"}'
                        </div>
                        <div class="mt-2 text-gray-400">
                            :: 调用工具（以语音合成为例）
                        </div>
                        <div>
                            aigcpanel tools --name SoundGenerate --param
                            '{"text":"你好"}'
                        </div>
                    </div>
                    <div class="mt-3 text-sm text-gray-500">
                        {{ $t("cli.configPath") }}
                    </div>
                    <div class="mt-3">
                        <a-button @click="docVisible = true">
                            <template #icon><icon-file /></template>
                            查看完整文档
                        </a-button>
                    </div>
                </div>
            </div>
        </template>

        <!-- 完整文档弹窗 -->
        <a-modal
            v-model:visible="docVisible"
            :width="'min(900px, 92vw)'"
            :footer="false"
            title-align="start"
            modal-class="modal-independent-scroll"
            :body-style="{ padding: '0', height: 'calc(100vh - 12rem)' }"
            :modal-style="{ 'max-height': 'calc(100vh - 4rem)' }"
        >
            <template #title
                ><div class="font-bold">CLI 工具完整文档</div></template
            >
            <MarkdownDocViewer :content="cliDocContent" />
        </a-modal>
    </div>
</template>
