<script setup lang="ts">
import { computed } from "vue";
import ImagePreviewBox from "./ImagePreviewBox.vue";
import VideoPreviewBox from "./VideoPreviewBox.vue";
import AudioPlayerButton from "./AudioPlayerButton.vue";
import TextTruncateView from "../TextTruncateView.vue";
import { Dialog } from "../../lib/dialog";
import { t } from "../../lang";

/**
 * 通用结果展示组件。
 *
 * 输出类型仅三种：
 * - file：单文件类型（值为文件路径字符串，按扩展名识别图片/视频/音频并提供对应预览，其余文件提供导出）
 * - files：多文件类型（值为文件路径数组，每个文件按扩展名提供对应预览/导出）
 * - text：文本类型（文字展示 + 复制）
 *
 * 支持两种模式：
 * 1. 有 resultDef（config.json general[].result 定义数组）：
 *    遍历 [{ type, name, title }]，从 result[name] 取值并按 type 渲染。
 * 2. 无 resultDef：按 result 的 url / files / text / records 字段常规渲染
 *    （url / files 为文件类型，text / records 为文本类型）。
 *
 * 结果中的文件在任务成功时已归档到软件自身存储（hub），
 * 此处导出（导出 = 打开系统保存对话框另存为）。
 */
const props = defineProps<{
    result?: any;
    resultDef?: any[];
}>();

// 按扩展名识别文件种类（image / video / audio / other）
const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];
const VIDEO_EXT = ["mp4", "webm", "mov", "mkv", "avi", "m4v", "ogv"];
const AUDIO_EXT = ["mp3", "wav", "flac", "ogg", "aac", "m4a", "wma", "opus"];

const fileKind = (url: string): string => {
    const clean = (url + "").split("?")[0].toLowerCase();
    const ext = clean.includes(".") ? clean.split(".").pop() || "" : "";
    if (IMAGE_EXT.includes(ext)) return "image";
    if (VIDEO_EXT.includes(ext)) return "video";
    if (AUDIO_EXT.includes(ext)) return "audio";
    return "other";
};

const toList = (v: any): string[] => {
    if (v == null) return [];
    return Array.isArray(v) ? v.filter(Boolean) : [v];
};

// 模式 1：按 resultDef 定义渲染（输出类型仅 file / files / text）
const defItems = computed(() => {
    if (!Array.isArray(props.resultDef) || props.resultDef.length === 0) {
        return null;
    }
    return props.resultDef
        .map((def: any) => ({
            type: def.type,
            title: def.title || def.name || "",
            values: toList(props.result?.[def.name]),
        }))
        .filter((item: any) => item.values.length > 0);
});

// 模式 2：无 resultDef 时常规渲染
const fallback = computed(() => {
    const r = props.result || {};
    const urls = toList(r.url).concat(toList(r.files));
    return {
        urls,
        text: r.text || "",
        records: r.records || [],
    };
});

// 统一渲染项：模式 1 按 resultDef 分组，模式 2 将 url/files 作为单个文件分组
const displayItems = computed(() => {
    if (defItems.value) {
        return defItems.value;
    }
    return [
        {
            type: "file",
            title: "",
            values: fallback.value.urls,
        },
    ];
});

/**
 * 导出文件：打开系统保存对话框，把结果文件另存为用户选择的位置。
 * 远程地址（http/https）先下载到临时文件再保存。
 */
const onExport = async (url: string, name?: string) => {
    try {
        const fileExt = url.split(".").pop()?.split("?")[0] || "";
        const defaultName = name ? `${name}.${fileExt}` : "";
        const savePath = await window.$mapi.file.openSave({
            ...(defaultName ? { defaultPath: defaultName } : {}),
        });
        if (!savePath) {
            return;
        }
        let fromPath = url;
        let tempPath: string | null = null;
        if (/^https?:\/\//i.test(url)) {
            tempPath = await window.$mapi.file.temp(
                fileExt || "bin",
                "download",
            );
            await window.$mapi.file.download(url, tempPath, {
                isDataPath: false,
            });
            fromPath = tempPath;
        }
        try {
            await window.$mapi.file.copy(fromPath, savePath, {
                isDataPath: false,
            });
        } finally {
            if (tempPath) {
                await window.$mapi.file.deletes(tempPath, {
                    isDataPath: false,
                });
            }
        }
        Dialog.tipSuccess(t("msg.fileSavedTo", { path: savePath }));
    } catch (e) {
        Dialog.tipError(String(e));
    }
};
</script>

<template>
    <div>
        <!-- 统一渲染：file 按格式预览/导出，text 展示文字 -->
        <template v-if="displayItems.length > 0">
            <div v-for="(item, i) in displayItems" :key="i" class="mt-2">
                <div v-if="item.title" class="text-xs text-gray-500 mb-1">
                    {{ item.title }}
                </div>
                <div class="flex flex-wrap gap-2">
                    <!-- 文本类型（text）：文字展示 + 复制 -->
                    <template v-if="item.type === 'text'">
                        <div
                            class="bg-gray-100 rounded-lg p-2 flex-grow min-w-40"
                        >
                            <TextTruncateView :text="item.values.join('\n')" />
                        </div>
                    </template>
                    <!-- 文件类型（file 单文件 / files 多文件）：按扩展名识别格式，图片/视频/音频预览，其余导出 -->
                    <template
                        v-else-if="
                            item.type === 'file' || item.type === 'files'
                        "
                    >
                        <template v-for="(url, j) in item.values" :key="j">
                            <!-- 图片：图片预览 -->
                            <div
                                v-if="fileKind(url) === 'image'"
                                class="flex flex-col items-start gap-1"
                            >
                                <ImagePreviewBox :url="url" />
                                <a
                                    href="javascript:;"
                                    class="text-blue-600 text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100"
                                    @click="
                                        onExport(
                                            url,
                                            (item.title || 'image') + (j + 1),
                                        )
                                    "
                                >
                                    <icon-download />
                                    {{ $t("common.export") }}
                                </a>
                            </div>
                            <!-- 视频：播放器预览 -->
                            <div
                                v-else-if="fileKind(url) === 'video'"
                                class="flex flex-col items-start gap-1"
                            >
                                <VideoPreviewBox
                                    :url="url"
                                    width="20rem"
                                    height="12rem"
                                />
                                <a
                                    href="javascript:;"
                                    class="text-blue-600 text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100"
                                    @click="
                                        onExport(
                                            url,
                                            (item.title || 'video') + (j + 1),
                                        )
                                    "
                                >
                                    <icon-download />
                                    {{ $t("common.export") }}
                                </a>
                            </div>
                            <!-- 音频：播放器预览 -->
                            <div
                                v-else-if="fileKind(url) === 'audio'"
                                class="flex items-center gap-1"
                            >
                                <AudioPlayerButton :source="url" />
                                <a
                                    href="javascript:;"
                                    class="text-blue-600 text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100"
                                    @click="
                                        onExport(
                                            url,
                                            (item.title || 'audio') + (j + 1),
                                        )
                                    "
                                >
                                    <icon-download />
                                    {{ $t("common.export") }} {{ item.title }}
                                    {{ j + 1 }}
                                </a>
                            </div>
                            <!-- 其他文件：导出 -->
                            <a
                                v-else
                                href="javascript:;"
                                class="text-blue-600 text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100"
                                @click="
                                    onExport(
                                        url,
                                        (item.title || 'file') + (j + 1),
                                    )
                                "
                            >
                                <icon-download />
                                {{ $t("common.export") }} {{ item.title }}
                                {{ j + 1 }}
                            </a>
                        </template>
                    </template>
                    <!-- 未知类型兜底：按文件导出 -->
                    <template v-else>
                        <a
                            v-for="(url, j) in item.values"
                            :key="j"
                            href="javascript:;"
                            class="text-blue-600 text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 hover:bg-blue-100"
                            @click="
                                onExport(url, (item.title || 'file') + (j + 1))
                            "
                        >
                            <icon-download />
                            {{ $t("common.export") }} {{ item.title }}
                            {{ j + 1 }}
                        </a>
                    </template>
                </div>
            </div>
        </template>

        <!-- 模式 2 附加：文本类结果（text / records） -->
        <template v-if="!defItems">
            <div v-if="fallback.text" class="bg-gray-100 rounded-lg p-2 mt-2">
                <TextTruncateView :text="fallback.text" />
            </div>
            <div
                v-if="fallback.records && fallback.records.length > 0"
                class="bg-gray-100 rounded-lg p-2 mt-2 text-sm"
            >
                <div
                    v-for="(rec, i) in fallback.records"
                    :key="i"
                    class="mb-1 last:mb-0"
                >
                    <!-- 文字记录支持一键复制 -->
                    <TextTruncateView :text="rec.text || JSON.stringify(rec)" />
                </div>
            </div>
        </template>
    </div>
</template>
