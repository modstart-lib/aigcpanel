<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useModelStore } from "./store/model";
import { ModelType } from "./types";
import { testActionSet, testActionUnset } from "../../utils/test";
import ProviderAddDialog from "./components/ProviderAddDialog.vue";
import ProviderEditDialog from "./components/ProviderEditDialog.vue";
import { getProviderUrl } from "./providers";
import ModelAddDialog from "./components/ModelAddDialog.vue";
import ModelEditDialog from "./components/ModelEditDialog.vue";
import ProviderTestDialog from "./components/ProviderTestDialog.vue";
import { getModelLogo } from "./models";
import { useUserStore } from "../../store/modules/user";
import { useSettingStore } from "../../store/modules/setting";

const userStore = useUserStore();
const setting = useSettingStore();
const modelStore = useModelStore();
const providerAdd = ref<InstanceType<typeof ProviderAddDialog> | null>(null);
const providerEdit = ref<InstanceType<typeof ProviderEditDialog> | null>(null);
const modelAdd = ref<InstanceType<typeof ModelAddDialog> | null>(null);
const modelEdit = ref<InstanceType<typeof ModelEditDialog> | null>(null);
const providerTest = ref<InstanceType<typeof ProviderTestDialog> | null>(null);


const keywords = ref("");
const currentProviderId = ref("");

const doSelectProvider = (id: string) => {
    currentProviderId.value = id;
};
const provider = computed(() => {
    return modelStore.providers.find((p) => p.id === currentProviderId.value);
});
const providerUrl = computed(() => {
    if (!provider.value) return "";
    return getProviderUrl(provider.value as any);
});
const providerModelGroups = computed(() => {
    if (!provider.value) {
        return [];
    }
    const models = provider.value.data.models;
    const groups = models
        .map((m) => m.group)
        .filter((v, i, a) => a.indexOf(v) === i);
    return groups.map((g) => {
        return {
            group: g,
            models: models.filter((m) => m.group === g),
        };
    });
});
const providersFilter = computed(() => {
    return modelStore.providers.filter((p) => {
        if (keywords.value) {
            return p.title.toLowerCase().includes(keywords.value.toLowerCase());
        }
        return true;
    });
});
watch(
    () => modelStore.providers,
    () => {
        if (!currentProviderId.value && modelStore.providers.length > 0) {
            doSelectProvider(modelStore.providers[0].id);
        }
    },
    { immediate: true },
);

const testActionNames = [
    "ModelSetting.providers",
    "ModelSetting.selectProvider",
    "ModelSetting.models",
    "ModelSetting.enabledModels",
    "ModelSetting.changeProvider",
    "ModelSetting.chat",
    "ModelSetting.modelAdd.show",
    "ModelSetting.modelAdd.fill",
    "ModelSetting.modelAdd.submit",
    "ModelSetting.modelEdit.show",
    "ModelSetting.modelEdit.fill",
    "ModelSetting.modelEdit.submit",
    "ModelSetting.modelDelete",
];

onMounted(() => {
    testActionSet("ModelSetting.providers", () => {
        return modelStore.providers.map((p) => ({
            id: p.id,
            title: p.title,
            enabled: p.data.enabled,
        }));
    });
    testActionSet("ModelSetting.selectProvider", (params: any) => {
        doSelectProvider(params?.providerId || "");
    });
    testActionSet("ModelSetting.models", () => {
        return (provider.value?.data.models || []).map((m) => ({
            id: m.id,
            name: m.name,
            group: m.group,
            type: m.type,
            caps: m.caps ? Object.assign({}, m.caps) : {},
            enabled: m.enabled,
        }));
    });
    testActionSet("ModelSetting.enabledModels", async (params: any) => {
        return await modelStore.enabledModels(params?.type as ModelType);
    });
    testActionSet("ModelSetting.changeProvider", async (params: any) => {
        await modelStore.change(
            currentProviderId.value,
            params?.key,
            params?.value,
        );
    });
    testActionSet("ModelSetting.chat", async (params: any) => {
        return await modelStore.chat(
            currentProviderId.value,
            params?.modelId || "",
            params?.prompt || "",
            { systemPrompt: null, extra: params?.extra },
        );
    });
    testActionSet("ModelSetting.modelAdd.show", () => {
        modelAdd.value?.show();
    });
    testActionSet("ModelSetting.modelAdd.fill", (params: any) => {
        modelAdd.value?.fill(params || {});
    });
    testActionSet("ModelSetting.modelAdd.submit", () => {
        modelAdd.value?.doSubmit();
    });
    testActionSet("ModelSetting.modelEdit.show", (params: any) => {
        const m = provider.value?.data.models.find(
            (m) => m.id === params?.modelId,
        );
        if (m) {
            modelEdit.value?.show(m);
        }
    });
    testActionSet("ModelSetting.modelEdit.fill", (params: any) => {
        modelEdit.value?.fill(params || {});
    });
    testActionSet("ModelSetting.modelEdit.submit", () => {
        modelEdit.value?.doSubmit();
    });
    testActionSet("ModelSetting.modelDelete", async (params: any) => {
        await modelStore.modelDelete(
            currentProviderId.value,
            params?.modelId || "",
        );
    });
});

onUnmounted(() => {
    testActionUnset(testActionNames);
});
</script>

<template>
    <div class="flex h-full">
        <div class="w-48 border-r flex flex-col flex-shrink-0">
            <div class="p-2">
                <a-input
                    :placeholder="$t('model.searchPlatform')"
                    v-model="keywords"
                >
                    <template #suffix>
                        <icon-search />
                    </template>
                </a-input>
            </div>
            <div class="flex-grow p-2 overflow-x-hidden overflow-y-auto">
                <div
                    v-if="
                        !providersFilter.length && modelStore.providers.length
                    "
                >
                    <a-empty :description="$t('empty.noModelPlatform')" />
                </div>
                <div v-for="p in providersFilter">
                    <div
                        class="flex hover:bg-gray-100 cursor-pointer border border-transparent rounded-full mb-3 px-3 py-1 items-center"
                        :class="
                            currentProviderId === p.id
                                ? 'bg-gray-100 border-gray-300'
                                : ''
                        "
                        @click="doSelectProvider(p.id)"
                    >
                        <div class="mr-2">
                            <img
                                v-if="p.logo"
                                class="w-[20px] h-[20px] rounded"
                                style="background: #eee; border: 1px solid #eee"
                                :src="p.logo"
                            />
                            <a-avatar
                                v-else
                                :size="20"
                                shape="square"
                                :style="{ backgroundColor: '#3370ff' }"
                            >
                                {{ p.title }}
                            </a-avatar>
                        </div>
                        <div class="flex-grow">
                            {{ p.title }}
                        </div>
                        <div v-if="p.data.enabled">
                            <icon-check-circle class="text-green-600" />
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-2">
                <a-button class="w-full" @click="providerAdd?.show()">
                    {{ $t("common.add") }}
                    <template #icon>
                        <icon-plus />
                    </template>
                </a-button>
            </div>
        </div>
        <div class="flex-grow overflow-y-auto overflow-x-hidden">
            <div class="py-20" v-if="!provider">
                <a-empty :description="$t('hint.selectPlatform')" />
            </div>
            <div v-else class="p-3">
                <div class="flex items-center border-b pb-3 mb-3">
                    <div class="font-bold mr-2">
                        {{ provider.title }}
                    </div>
                    <div class="flex-grow">
                        <a
                            v-if="!provider.isSystem"
                            href="javascript:;"
                            class="mr-2"
                            @click="providerEdit?.show(provider)"
                        >
                            <icon-edit />
                        </a>
                        <a
                            v-if="!provider.isSystem"
                            href="javascript:;"
                            class="mr-2"
                            @click="modelStore.providerDelete(provider.id)"
                        >
                            <icon-delete />
                        </a>
                        <a
                            v-if="provider?.websites.official"
                            class="mr-2"
                            target="_blank"
                            :href="provider?.websites.official"
                        >
                            <icon-desktop />
                        </a>
                    </div>
                    <div>
                        <a-switch
                            :model-value="provider.data.enabled"
                            @change="
                                modelStore.change(
                                    provider.id,
                                    'data.enabled',
                                    $event,
                                )
                            "
                        />
                    </div>
                </div>
                <div class="mb-3" v-if="provider.id !== 'buildIn'">
                    <div class="mb-2 font-bold">{{ $t("setting.apiKey") }}</div>
                    <div>
                        <a-input-password
                            :model-value="provider.data.apiKey"
                            @input="
                                modelStore.change(
                                    provider.id,
                                    'data.apiKey',
                                    $event,
                                )
                            "
                            class="w-full"
                        >
                            <template #suffix>
                                <a
                                    href="javascript:;"
                                    @click="providerTest?.show()"
                                    class="ml-2"
                                >
                                    {{ $t("common.check") }}
                                </a>
                            </template>
                        </a-input-password>
                    </div>
                </div>
                <div class="mb-3" v-if="provider.id !== 'buildIn'">
                    <div class="mb-2 font-bold">{{ $t("setting.apiUrl") }}</div>
                    <div>
                        <a-input
                            :model-value="provider.data.apiHost"
                            :placeholder="provider.apiUrl"
                            @input="
                                modelStore.change(
                                    provider.id,
                                    'data.apiHost',
                                    $event,
                                )
                            "
                            class="w-full"
                        >
                        </a-input>
                    </div>
                    <div class="flex">
                        <div class="text-gray-400">
                            {{ providerUrl }}
                        </div>
                    </div>
                </div>
                <div
                    class="mb-3 flex border rounded p-3 items-center"
                    v-if="provider.id === 'buildIn'"
                >
                    
                </div>
                <div class="mb-3">
                    <div class="mb-2 font-bold">{{ $t("model.model") }}</div>
                    <div
                        class="mb-2 text-sm text-gray-400"
                        v-if="provider.id !== 'buildIn'"
                    >
                        {{ $t("common.view") }}
                        <a
                            :href="provider?.websites.docs"
                            target="_blank"
                            class="text-blue-600"
                        >
                            {{ provider.title }}
                            {{ $t("common.docs") }}
                        </a>
                        {{ $t("common.and") }}
                        <a
                            :href="provider?.websites.models"
                            target="_blank"
                            class="text-blue-600"
                        >
                            {{ provider.title }}
                            {{ $t("model.list") }}
                        </a>
                        {{ $t("common.moreDetails") }}
                    </div>
                    <div
                        v-for="g in providerModelGroups"
                        :key="provider.id + g.group"
                        class="mb-2"
                    >
                        <a-collapse :default-active-key="[g.group]">
                            <a-collapse-item :header="g.group" :key="g.group">
                                <div class="-ml-6 -mr-1">
                                    <div
                                        v-for="m in g.models"
                                        class="border mb-3 rounded-lg bg-white flex p-2 items-center"
                                    >
                                        <div class="mr-2">
                                            <a-avatar
                                                :image-url="getModelLogo(m.id)"
                                                :size="20"
                                                shape="square"
                                                style="border: 1px solid #ccc"
                                            />
                                        </div>
                                        <div
                                            class="flex-grow flex items-center gap-1"
                                        >
                                            {{ m.name }}
                                            <icon-file
                                                v-if="m.type === 'text'"
                                                :title="$t('model.typeText')"
                                                class="text-blue-500"
                                            />
                                            <icon-eye
                                                v-if="m.caps?.vision"
                                                :title="$t('model.capVision')"
                                                class="text-blue-500 text-sm"
                                            />
                                            <icon-tool
                                                v-if="m.caps?.tools"
                                                :title="$t('model.capTools')"
                                                class="text-green-500 text-sm"
                                            />
                                        </div>
                                        <div
                                            v-if="
                                                provider.id === 'buildIn' &&
                                                m.rate != null
                                            "
                                            class="mr-3 text-xs text-gray-400"
                                        >
                                            
                                        </div>
                                        <div class="flex items-center">
                                            <a-switch
                                                :model-value="m.enabled"
                                                @change="
                                                    modelStore.changeModel(
                                                        provider.id,
                                                        m.id,
                                                        'enabled',
                                                        $event,
                                                    )
                                                "
                                                class="mr-2"
                                            ></a-switch>
                                            <a-button
                                                @click="modelEdit?.show(m)"
                                                v-if="provider.id !== 'buildIn'"
                                                class="mr-2"
                                            >
                                                <template #icon>
                                                    <icon-settings />
                                                </template>
                                            </a-button>
                                            <a-button
                                                @click="
                                                    modelStore.modelDelete(
                                                        provider.id,
                                                        m.id,
                                                    )
                                                "
                                                v-if="provider.id !== 'buildIn'"
                                            >
                                                <template #icon>
                                                    <icon-delete />
                                                </template>
                                            </a-button>
                                        </div>
                                    </div>
                                </div>
                            </a-collapse-item>
                        </a-collapse>
                    </div>
                    <div class="mb-2" v-if="provider.id !== 'buildIn'">
                        <a-button @click="modelAdd?.show()">
                            <template #icon>
                                <icon-plus />
                            </template>
                            {{ $t("common.add") }}
                        </a-button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <ProviderAddDialog ref="providerAdd" />
    <ProviderEditDialog ref="providerEdit" />
    <ModelAddDialog ref="modelAdd" :provider="provider" />
    <ModelEditDialog ref="modelEdit" :provider="provider" />
    <ProviderTestDialog ref="providerTest" :provider="provider" />
</template>
