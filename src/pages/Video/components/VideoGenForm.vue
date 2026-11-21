<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import ParamForm from "../../../components/common/ParamForm.vue";
import ServerContentInfoAction from "../../../components/Server/ServerContentInfoAction.vue";
import ServerSelector from "../../../components/Server/ServerSelector.vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { StorageUtil } from "../../../lib/storage";
import { useServerStore } from "../../../store/modules/server";
import { EnumServerStatus } from "../../../types/Server";
import VideoTemplateSelector from "./VideoTemplateSelector.vue";
import { VideoTemplateService } from "../../../service/VideoTemplateService";

const serverStore = useServerStore();
const formData = ref({
    serverKey: "",
    videoTemplateId: 0,
});
const paramForm = ref<InstanceType<typeof ParamForm>>();
const param = ref([]);
const modelConfig = ref(null);

const onServerUpdate = async (config: any) => {
    // VideoGen uses the params defined by the "videoGen" function
    param.value = config.functions.videoGen?.param || [];
    modelConfig.value = config;
};

onMounted(async () => {
    const old = StorageUtil.getObject("VideoGenForm.formData");
    formData.value.serverKey = old.serverKey || "";
});

watch(
    () => formData.value,
    async (value) => {
        StorageUtil.set("VideoGenForm.formData", value);
    },
    {
        deep: true,
    },
);

const getValue = async (): Promise<VideoGenParamType | undefined> => {
    const data: any = {};
    data.serverKey = formData.value.serverKey;

    const server = await serverStore.getByKey(data.serverKey);
    if (!server) {
        Dialog.tipError(t("hint.selectAvatarModel"));
        return;
    }
    if (server.status !== EnumServerStatus.RUNNING) {
        Dialog.tipError(t("error.avatarModelNotStarted"));
        return;
    }

    if (!formData.value.videoTemplateId) {
        Dialog.tipError(t("hint.selectVideo"));
        return;
    }
    const videoTemplate = await VideoTemplateService.get(
        formData.value.videoTemplateId,
    );
    if (!videoTemplate) {
        Dialog.tipError(t("hint.selectVideo"));
        return;
    }

    data.serverName = server.name;
    data.serverTitle = server.title;
    data.serverVersion = server.version;
    data.videoTemplateId = formData.value.videoTemplateId;
    data.videoTemplateName = videoTemplate.name;
    data.videoTemplateUrl = videoTemplate.video;

    data.param = paramForm.value ? paramForm.value.getValue() : {};
    if (!data.param) {
        Dialog.tipError(t("error.videoGenParamInvalid"));
        return;
    }

    return data;
};

const setValue = (
    data: Partial<{ serverKey: string; videoTemplateId: number; param: any }>,
) => {
    if (data.serverKey !== undefined) {
        formData.value.serverKey = data.serverKey;
    }
    if (data.videoTemplateId !== undefined) {
        formData.value.videoTemplateId = data.videoTemplateId;
    }
    if (data.param !== undefined) {
        paramForm.value?.setValue(data.param);
    }
};

defineExpose({
    getValue,
    setValue,
});
</script>

<template>
    <div class="mb-4">
        <div class="font-bold">
            <icon-settings />
            {{ $t("avatar.config") }}
        </div>
        <div class="flex items-center h-12 mb-2">
            <div class="mr-1">
                <a-tooltip :content="$t('avatar.model')" mini>
                    <i-mdi-server-outline class="w-4 h-4" />
                </a-tooltip>
            </div>
            <div class="mr-2 w-96 flex-shrink-0">
                <ServerSelector
                    v-model="formData.serverKey"
                    @update="onServerUpdate"
                    functionName="videoGen"
                />
            </div>
            <div>
                <ServerContentInfoAction
                    :config="modelConfig as any"
                    func="videoGen"
                />
            </div>
        </div>
        <div class="flex items-center h-12 mb-2">
            <div class="mr-1">
                <a-tooltip :content="$t('avatar.video')" mini>
                    <i-mdi-video-box class="w-4 h-4" />
                </a-tooltip>
            </div>
            <div class="mr-3 w-56 flex-shrink-0">
                <VideoTemplateSelector v-model="formData.videoTemplateId" />
            </div>
        </div>
        <!-- 用户输入信息（声音等）插入 Server 选择与自定义参数之间 -->
        <div class="mb-2">
            <slot />
        </div>
        <div class="flex items-start mt-2" v-if="param.length > 0">
            <div class="pt-3 w-5 flex-shrink-0">
                <a-tooltip :content="$t('model.customParam')" mini>
                    <i-mdi-tune-variant class="w-4 h-4" />
                </a-tooltip>
            </div>
            <div class="flex-grow min-w-0">
                <ParamForm ref="paramForm" :param="param" />
            </div>
        </div>
    </div>
</template>
