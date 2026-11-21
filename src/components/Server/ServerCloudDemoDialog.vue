<script setup lang="ts">
import { ref } from "vue";
import { ServerCloudRecord } from "../../store/modules/serverCloud";

const visible = ref(false);

const record = ref<ServerCloudRecord | null>(null);

const show = (r: ServerCloudRecord) => {
    record.value = r;
    visible.value = true;
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="70vw"
        :footer="false"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
    >
        <template #title>
            {{ record?.title }}
        </template>
        <div>
            <div>
                <div v-for="d in record?.demo">
                    <div class="shadow rounded-lg p-3">
                        <!-- audio 类型 -->
                        <div
                            v-if="d.type === 'audio'"
                            class="p-3 bg-gray-200 rounded-lg mb-3"
                        >
                            <audio
                                controls
                                preload="none"
                                style="width: 100%; max-height: 70vh"
                            >
                                <source :src="d.url1" type="audio/mpeg" />
                            </audio>
                            <div class="font-bold">{{ d.title1 }}</div>
                        </div>

                        <!-- audio2 类型 -->
                        <div v-else-if="d.type === 'audio2'" class="flex gap-3">
                            <div style="width: 50%" class="flex-shrink-0">
                                <div class="p-3 bg-gray-200 rounded-lg mb-3">
                                    <audio
                                        controls
                                        preload="none"
                                        style="width: 100%; max-height: 70vh"
                                    >
                                        <source
                                            :src="d.url1"
                                            type="audio/mpeg"
                                        />
                                    </audio>
                                </div>
                                <div class="font-bold">{{ d.title1 }}</div>
                            </div>
                            <div class="flex-grow">
                                <div class="p-3 bg-gray-200 rounded-lg mb-3">
                                    <audio
                                        controls
                                        preload="none"
                                        style="width: 100%; max-height: 70vh"
                                    >
                                        <source
                                            :src="d.url2"
                                            type="audio/mpeg"
                                        />
                                    </audio>
                                </div>
                                <div class="font-bold">{{ d.title2 }}</div>
                            </div>
                        </div>

                        <!-- video 类型 -->
                        <div
                            v-else-if="d.type === 'video'"
                            class="p-3 bg-gray-200 rounded-lg mb-3"
                        >
                            <video
                                controls
                                preload="none"
                                style="width: 100%; max-height: 70vh"
                            >
                                <source :src="d.url1" type="video/mp4" />
                            </video>
                            <div class="font-bold">{{ d.title1 }}</div>
                        </div>

                        <!-- video2 类型 -->
                        <div v-else-if="d.type === 'video2'" class="flex gap-3">
                            <div style="width: 50%" class="flex-shrink-0">
                                <div class="p-3 bg-gray-200 rounded-lg mb-3">
                                    <video
                                        controls
                                        preload="none"
                                        style="width: 100%; max-height: 70vh"
                                    >
                                        <source
                                            :src="d.url1"
                                            type="video/mp4"
                                        />
                                    </video>
                                </div>
                                <div class="font-bold">{{ d.title1 }}</div>
                            </div>
                            <div class="flex-grow">
                                <div class="p-3 bg-gray-200 rounded-lg mb-3">
                                    <video
                                        controls
                                        preload="none"
                                        style="width: 100%; max-height: 70vh"
                                    >
                                        <source
                                            :src="d.url2"
                                            type="video/mp4"
                                        />
                                    </video>
                                </div>
                                <div class="font-bold">{{ d.title2 }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
