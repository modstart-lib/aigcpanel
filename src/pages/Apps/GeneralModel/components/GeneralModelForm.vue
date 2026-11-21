<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import ParamForm from "../../../../components/common/ParamForm.vue";
import ServerSelector from "../../../../components/Server/ServerSelector.vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { StorageUtil } from "../../../../lib/storage";
import { useServerStore } from "../../../../store/modules/server";
import { GeneralModelParamType } from "../type";

const serverStore = useServerStore();
const formData = ref({
    serverKey: "",
    funcName: "",
});
const paramForm = ref<InstanceType<typeof ParamForm>>();
const param = ref<any[]>([]);
const resultDef = ref<any[]>([]);
// 当前模型的通用能力列表（config.json general 数组）
const generalList = ref<any[]>([]);

const currentFunc = computed(() => {
    return generalList.value.find((g) => g.name === formData.value.funcName);
});

const onServerUpdate = async (config: any) => {
    generalList.value = config.general || [];
    if (generalList.value.length > 0) {
        formData.value.funcName = generalList.value[0].name;
        onFuncChange();
    } else {
        param.value = [];
        resultDef.value = [];
    }
};

const onFuncChange = () => {
    const func = currentFunc.value;
    param.value = func?.param || [];
    resultDef.value = func?.result || [];
    // 重置参数表单为默认值
    paramForm.value?.setValue({});
};

onMounted(async () => {
    const old = StorageUtil.getObject("GeneralModelForm.formData");
    formData.value.serverKey = old.serverKey || "";
    formData.value.funcName = old.funcName || "";
});

watch(
    () => formData.value,
    async (value) => {
        StorageUtil.set("GeneralModelForm.formData", value);
    },
    {
        deep: true,
    },
);

const getValue = async (): Promise<GeneralModelParamType | undefined> => {
    const data: any = {};
    data.type = "GeneralModel";
    data.serverKey = formData.value.serverKey;
    data.funcName = formData.value.funcName;

    const server = await serverStore.getByKey(data.serverKey);
    if (!server) {
        Dialog.tipError(t("general.selectModel"));
        return;
    }
    if (!data.funcName) {
        Dialog.tipError(t("general.selectFunc"));
        return;
    }

    data.serverName = server.name;
    data.serverTitle = server.title;
    data.serverVersion = server.version;
    data.param = paramForm.value ? paramForm.value.getValue() : {};
    data.resultDef = resultDef.value || [];

    if (!data.param) {
        Dialog.tipError(t("general.invalidParam"));
        return;
    }

    return data;
};

const setValue = (data: Partial<GeneralModelParamType>) => {
    if (data.serverKey !== undefined) {
        formData.value.serverKey = data.serverKey;
    }
    if (data.funcName !== undefined) {
        formData.value.funcName = data.funcName;
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
            {{ t("general.config") }}
        </div>
        <div class="flex items-start min-h-8 max-w-lg w-full gap-1">
            <div class="pt-2">
                <a-tooltip :content="t('general.model.title')" mini>
                    <i-mdi-server-outline class="w-4 h-4" />
                </a-tooltip>
            </div>
            <div class="flex-grow flex flex-wrap gap-1">
                <ServerSelector
                    v-model="formData.serverKey"
                    @update="onServerUpdate"
                    functionName="general"
                />
                <a-select
                    v-if="generalList.length > 0"
                    v-model="formData.funcName"
                    :placeholder="t('general.selectFunction')"
                    size="small"
                    class="min-w-40"
                    style="height: 32px"
                    @change="onFuncChange"
                >
                    <a-option
                        v-for="g in generalList"
                        :key="g.name"
                        :value="g.name"
                    >
                        {{ g.title || g.name }}
                    </a-option>
                </a-select>
            </div>
        </div>
        <div
            v-if="currentFunc && currentFunc.description"
            class="text-xs text-gray-400 mt-1 ml-6"
        >
            {{ currentFunc.description }}
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
