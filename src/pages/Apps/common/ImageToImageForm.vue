<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import ParamForm from "../../../components/common/ParamForm.vue";
import ServerContentInfoAction from "../../../components/Server/ServerContentInfoAction.vue";
import ServerSelector from "../../../components/Server/ServerSelector.vue";
import ServerWorkflowSelector from "../../../components/Server/ServerWorkflowSelector.vue";
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
const modelConfig = ref<any>(null);
const workflows = ref<any[]>([]);
const comfyuiName = ref("");

const applyWorkflowParam = () => {
    const wf = workflows.value.find((w) => w.key === comfyuiName.value);
    param.value = wf ? wf.param || [] : [];
};

const onServerUpdate = async (config: any) => {
    const fn = config.functions?.imageToImage || {};
    workflows.value = fn.workflows || [];
    if (workflows.value.length > 0) {
        if (
            !comfyuiName.value ||
            !workflows.value.some((w) => w.key === comfyuiName.value)
        ) {
            comfyuiName.value = workflows.value[0].key;
        }
        applyWorkflowParam();
    } else {
        param.value = fn.param || [];
    }
    modelConfig.value = config;
};

watch(comfyuiName, () => {
    applyWorkflowParam();
});

onMounted(async () => {
    const old = StorageUtil.getObject("ImageToImageForm.formData");
    formData.value.serverKey = old.serverKey || "";
});

watch(
    () => formData.value,
    async (value) => {
        StorageUtil.set("ImageToImageForm.formData", value);
    },
    {
        deep: true,
    },
);

const getValue = async (): Promise<ImageToImageParamType | undefined> => {
    const data: any = {};
    data.type = "ImageToImage";
    data.serverKey = formData.value.serverKey;

    const server = await serverStore.getByKey(data.serverKey);
    if (!server) {
        Dialog.tipError(t("error.pleaseSelectImageToImageModel"));
        return;
    }
    if (server.status !== EnumServerStatus.RUNNING) {
        Dialog.tipError(t("error.imageToImageModelNotStarted"));
        return;
    }

    data.serverName = server.name;
    data.serverTitle = server.title;
    data.serverVersion = server.version;
    data.comfyuiName = comfyuiName.value || "";
    data.param = paramForm.value ? paramForm.value.getValue() : {};

    if (!data.param) {
        Dialog.tipError(t("error.imageToImageParamInvalid"));
        return;
    }

    return data;
};

const setValue = (data: Partial<ImageToImageParamType>) => {
    if (data.serverKey !== undefined) {
        formData.value.serverKey = data.serverKey;
    }
    if (data.comfyuiName !== undefined) {
        comfyuiName.value = data.comfyuiName;
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
            {{ $t("app.imageToImageConfig") }}
        </div>
        <div class="flex items-start min-h-8 max-w-lg w-full gap-1">
            <div class="pt-2">
                <a-tooltip :content="$t('app.imageToImageModel')" mini>
                    <i-mdi-server-outline class="w-4 h-4" />
                </a-tooltip>
            </div>
            <div class="flex-grow flex flex-wrap gap-1">
                <div>
                    <ServerSelector
                        v-model="formData.serverKey"
                        @update="onServerUpdate"
                        functionName="imageToImage"
                    />
                </div>
                <div class="">
                    <ServerContentInfoAction
                        :config="modelConfig"
                        func="imageToImage"
                    />
                </div>
            </div>
        </div>
        <div class="flex items-center mt-2" v-if="workflows.length > 0">
            <div class="mr-1 pt-1">
                <a-tooltip :content="$t('app.workflowSelect')" mini>
                    <i-mdi-image-multiple class="w-4 h-4" />
                </a-tooltip>
            </div>
            <ServerWorkflowSelector
                v-model="comfyuiName"
                :workflows="workflows"
            />
        </div>
        <!-- 用户输入信息（提示词等）插入 Server 选择与自定义参数之间 -->
        <div class="flex items-center mt-2">
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
