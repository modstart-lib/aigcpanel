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

const serverStore = useServerStore();
const formData = ref({
    serverKey: "",
});
const paramForm = ref<InstanceType<typeof ParamForm>>();
const param = ref([]);
const modelConfig = ref(null);

const onServerUpdate = async (config: any) => {
    param.value = config.functions.asr?.param || [];
    modelConfig.value = config;
};

onMounted(async () => {
    const old = StorageUtil.getObject("SoundAsrForm.formData");
    formData.value.serverKey = old.serverKey || "";
});

watch(
    () => formData.value,
    async value => {
        StorageUtil.set("SoundAsrForm.formData", value);
    },
    {
        deep: true,
    }
);

const getValue = async (): Promise<SoundAsrParamType | undefined> => {
    const data: any = {};
    data.type = "SoundAsr";
    data.serverKey = formData.value.serverKey;

    const server = await serverStore.getByKey(data.serverKey);
    if (!server) {
        Dialog.tipError(t("hint.selectRecognitionModel"));
        return;
    }
    if (server.status !== EnumServerStatus.RUNNING) {
        Dialog.tipError(t("error.recognitionModelNotStarted"));
        return;
    }

    data.serverName = server.name;
    data.serverTitle = server.title;
    data.serverVersion = server.version;
    data.param = paramForm.value ? paramForm.value.getValue() : {};

    if (!data.param) {
        Dialog.tipError(t("error.recognitionParamInvalid"));
        return;
    }

    return data;
};

const setValue = (data: Partial<SoundAsrParamType>) => {
    if (data.serverKey !== undefined) {
        formData.value.serverKey = data.serverKey;
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
        <div class="font-bold mb-2">
            <div class="inline-block w-5">
                <icon-settings />
            </div>
            {{ $t("voice.recognitionConfig") }}
        </div>
        <div class="flex items-start min-h-8 max-w-lg w-full gap-1">
            <div class="pt-2">
                <a-tooltip :content="$t('voice.recognitionModel')" mini>
                    <i class="iconfont icon-server"></i>
                </a-tooltip>
            </div>
            <div class="flex-grow flex flex-wrap gap-1">
                <div>
                    <ServerSelector v-model="formData.serverKey" @update="onServerUpdate" functionName="asr" />
                </div>
                <div class="">
                    <ServerContentInfoAction :config="modelConfig as any" func="asr" />
                </div>
            </div>
        </div>
        <div class="flex items-center mt-2" v-if="param && param.length > 0">
            <ParamForm ref="paramForm" :param="param" />
        </div>
    </div>
</template>
