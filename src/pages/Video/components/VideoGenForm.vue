<script setup lang="ts">
import {onMounted, ref, watch} from "vue";
import ParamForm from "../../../components/common/ParamForm.vue";
import ServerContentInfoAction from "../../../components/Server/ServerContentInfoAction.vue";
import ServerSelector from "../../../components/Server/ServerSelector.vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";
import {StorageUtil} from "../../../lib/storage";
import {useServerStore} from "../../../store/modules/server";
import {EnumServerStatus} from "../../../types/Server";
import VideoTemplateSelector from "./VideoTemplateSelector.vue";
import {VideoTemplateService} from "../../../service/VideoTemplateService";

const serverStore = useServerStore();
const formData = ref({
    serverKey: "",
    videoTemplateId: 0,
});
const paramForm = ref<InstanceType<typeof ParamForm>>();
const param = ref([]);
const modelConfig = ref(null);

const onServerUpdate = async (config: any) => {
    param.value = config.functions.asr?.param || [];
    modelConfig.value = config;
};

onMounted(async () => {
    const old = StorageUtil.getObject("VideoGenForm.formData");
    formData.value.serverKey = old.serverKey || "";
});

watch(
    () => formData.value,
    async value => {
        StorageUtil.set("VideoGenForm.formData", value);
    },
    {
        deep: true,
    }
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
    const videoTemplate = await VideoTemplateService.get(formData.value.videoTemplateId);
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

    data.param = paramForm.value?.getValue();
    if (!data.param) {
        Dialog.tipError(t("error.recognitionParamInvalid"));
        return;
    }

    return data;
};

defineExpose({
    getValue,
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
                    <i class="iconfont icon-server"></i>
                </a-tooltip>
            </div>
            <div class="mr-2 w-96 flex-shrink-0">
                <ServerSelector v-model="formData.serverKey" @update="onServerUpdate" functionName="videoGen" />
            </div>
            <div>
                <ServerContentInfoAction :config="modelConfig as any" func="videoGen" />
            </div>
        </div>
        <div class="flex items-center h-12 mb-2">
            <div class="mr-1">
                <a-tooltip :content="$t('avatar.video')" mini>
                    <i class="iconfont icon-video-template"></i>
                </a-tooltip>
            </div>
            <div class="mr-3 w-56 flex-shrink-0">
                <VideoTemplateSelector v-model="formData.videoTemplateId" />
            </div>
        </div>
        <div class="flex items-center">
            <ParamForm ref="paramForm" :param="param" />
        </div>
    </div>
</template>
