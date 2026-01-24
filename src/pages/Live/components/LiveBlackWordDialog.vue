<script setup lang="ts">
import {ref} from "vue";
import {detectBlackWords, highlightBlackWords} from "../config/blackWord";
import {StorageRecord} from "../../../service/StorageService";

type RecordWithViolations = StorageRecord & {
    violations: { word: string; index: number }[];
    highlightedTitle: string;
    highlightedReply: string;
    highlightedReplies: { value: string; highlightedValue: string }[];
};

const visible = ref(false);
const records = ref<StorageRecord[]>([]);
const violationRecords = ref<RecordWithViolations[]>([]);

const calc = async () => {
    violationRecords.value = [];
    for (const record of records.value) {
        const allText = [
            record.title || "",
            record.content.reply || "",
            ...(record.content.replies || []).map(r => r.value || ""),
            ...(record.content.tags || []),
        ].join(" ");
        const violations = await detectBlackWords(allText);
        if (violations.length > 0) {
            violationRecords.value.push({
                ...record,
                violations,
                highlightedTitle: await highlightBlackWords(record.title || ""),
                highlightedReply: await highlightBlackWords(record.content.reply || ""),
                highlightedReplies: await Promise.all(
                    (record.content.replies || []).map(async r => ({
                        ...r,
                        highlightedValue: await highlightBlackWords(r.value || ""),
                    }))
                ),
            });
        }
    }
};

const show = (allRecords: StorageRecord[]) => {
    records.value = allRecords;
    calc();
    visible.value = true;
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="90vw" :footer="false" title-align="start">
        <template #title>
            <div class="flex items-center">
                <icon-exclamation-circle class="text-red-500 mr-2"/>
                {{ $t("model.censorResult") }}
                <div class="ml-4 text-sm text-gray-500">共检测到 {{ violationRecords.length }} 条违规内容</div>
            </div>
        </template>
        <div class="-mx-4 -my-5 overflow-y" style="height: calc(100vh - 10rem)">
            <div v-if="violationRecords.length === 0" class="text-center py-48">
                <icon-check-circle class="text-green-500 text-6xl mb-4"/>
                <div class="text-xl font-bold text-green-600 mb-2">恭喜</div>
                <div class="text-gray-500">未检测到任何违规词汇</div>
            </div>
            <div v-else>
                <div class="mb-2">
                    <a-alert type="warning" show-icon>
                        <template #icon>
                            <icon-exclamation-circle/>
                        </template>
                        检测到 {{ violationRecords.length }} 条知识库内容包含违规词汇，建议及时修改避免直播风险
                    </a-alert>
                </div>
                <div>
                    <div
                        v-for="record in violationRecords"
                        :key="record.id"
                        class="border border-red-200 rounded-lg p-2 mb-2 bg-red-50"
                    >
                        <div class="flex items-center mb-1">
                            <div class="flex-grow">
                                <div class="font-bold text-red-800" v-html="record.highlightedTitle"></div>
                            </div>
                            <div class="text-sm text-red-600">违规词数: {{ record.violations.length }}</div>
                        </div>

                        <div v-if="record.content.reply" class="mb-1">
                            <div class="text-sm text-gray-600 mb-1">标准话术:</div>
                            <div class="text-sm" v-html="record.highlightedReply"></div>
                        </div>

                        <div v-if="record.content.replies && record.content.replies.length > 0" class="mb-1">
                            <div class="text-sm text-gray-600 mb-1">随机话术:</div>
                            <div class="space-y-1">
                                <div
                                    v-for="(reply, index) in record.highlightedReplies"
                                    :key="index"
                                    class="text-sm"
                                    v-html="reply.highlightedValue"
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>

<style scoped>
/* 确保高亮样式在 scoped 中正确显示 */
:deep(.bg-red-200) {
    background-color: rgb(254 202 202);
    color: rgb(153 27 27);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
}
</style>
