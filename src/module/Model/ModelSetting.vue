<script setup lang="ts">
import {computed, ref, watch} from "vue";
import {useModelStore} from "./store/model";
import ProviderAddDialog from "./components/ProviderAddDialog.vue";
import ProviderEditDialog from "./components/ProviderEditDialog.vue";
import {getProviderUrl} from "./providers";
import ModelAddDialog from "./components/ModelAddDialog.vue";
import ModelEditDialog from "./components/ModelEditDialog.vue";
import ProviderTestDialog from "./components/ProviderTestDialog.vue";
import {getModelLogo} from "./models";
import {useUserStore} from "../../store/modules/user";
import {useSettingStore} from "../../store/modules/setting";

const userStore = useUserStore();
const setting = useSettingStore();
const modelStore = useModelStore();
const providerAdd = ref<InstanceType<typeof ProviderAddDialog> | null>(null);
const providerEdit = ref<InstanceType<typeof ProviderEditDialog> | null>(null);
const modelAdd = ref<InstanceType<typeof ModelAddDialog> | null>(null);
const modelEdit = ref<InstanceType<typeof ModelEditDialog> | null>(null);
const providerTest = ref<InstanceType<typeof ProviderTestDialog> | null>(null);
const doUser = async () => {
    if (!setting.basic.userEnable) {
        return;
    }
    await window.$mapi.user.open({
        readyParam: {
            page: "ChargeLmApi",
        },
    });
};

const keywords = ref("");
const currentProviderId = ref("");

const doSelectProvider = (id: string) => {
    currentProviderId.value = id;
};
const provider = computed(() => {
    return modelStore.providers.find(p => p.id === currentProviderId.value);
});
const providerUrl = computed(() => {
    return getProviderUrl(provider.value as any);
});
const providerModelGroups = computed(() => {
    if (!provider.value) {
        return [];
    }
    const models = provider.value.data.models;
    const groups = models.map(m => m.group).filter((v, i, a) => a.indexOf(v) === i);
    return groups.map(g => {
        return {
            group: g,
            models: models.filter(m => m.group === g),
        };
    });
});
const providersFilter = computed(() => {
    return modelStore.providers.filter(p => {
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
    {immediate: true}
);
</script>

<template>
    <div class="flex h-full">
        <div class="w-48 border-r flex flex-col flex-shrink-0">
            <div class="p-2">
                <a-input :placeholder="$t('model.searchPlatform')" v-model="keywords">
                    <template #suffix>
                        <icon-search/>
                    </template>
                </a-input>
            </div>
            <div class="flex-grow p-2 overflow-x-hidden overflow-y-auto">
                <div v-if="!providersFilter.length && modelStore.providers.length">
                    <a-empty :description="$t('empty.noModelPlatform')"/>
                </div>
                <div v-for="p in providersFilter">
                    <div
                        class="flex hover:bg-gray-100 cursor-pointer border border-transparent rounded-full mb-3 px-3 py-1 items-center"
                        :class="currentProviderId === p.id ? 'bg-gray-100 border-gray-300' : ''"
                        @click="doSelectProvider(p.id)"
                    >
                        <div class="mr-2">
                            <img v-if="p.logo"
                                 class="w-[20px] h-[20px] rounded"
                                 style="background:#EEE;border:1px solid #EEE;"
                                 :src="p.logo"/>
                            <a-avatar v-else :size="20" shape="square"
                                      :style="{backgroundColor: '#3370ff'}">
                                {{ p.title }}
                            </a-avatar>
                        </div>
                        <div class="flex-grow">
                            {{ p.title }}
                        </div>
                        <div v-if="p.data.enabled">
                            <icon-check-circle class="text-green-600"/>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-2">
                <a-button class="w-full" @click="providerAdd?.show()">
                    {{ $t("common.add") }}
                    <template #icon>
                        <icon-plus/>
                    </template>
                </a-button>
            </div>
        </div>
        <div class="flex-grow overflow-y-auto overflow-x-hidden">
            <div class="py-20" v-if="!provider">
                <a-empty :description="$t('hint.selectPlatform')"/>
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
                            <icon-edit/>
                        </a>
                        <a
                            v-if="provider?.websites.official"
                            class="mr-2"
                            target="_blank"
                            :href="provider?.websites.official"
                        >
                            <icon-desktop/>
                        </a>
                    </div>
                    <div>
                        <a-switch
                            :model-value="provider.data.enabled"
                            @change="modelStore.change(provider.id, 'data.enabled', $event)"
                        />
                    </div>
                </div>
                <div class="mb-3" v-if="provider.id !== 'buildIn'">
                    <div class="mb-2 font-bold">{{ $t("setting.apiKey") }}</div>
                    <div>
                        <a-input-password
                            :model-value="provider.data.apiKey"
                            @input="modelStore.change(provider.id, 'data.apiKey', $event)"
                            class="w-full"
                        >
                            <template #suffix>
                                <a href="javascript:;" @click="providerTest?.show()" class="ml-2">
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
                            @input="modelStore.change(provider.id, 'data.apiHost', $event)"
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
                <div class="mb-3 flex border rounded p-3 items-center" v-if="provider.id === 'buildIn'">
                    <div class="flex-grow">
                        {{ $t("user.energy") }}
                        <span class="font-bold">{{ ((userStore.data.lmApi?.quota || 0) / 1000).toFixed(2) }}K</span>
                    </div>
                    <div class="text-gray-400">
                        <icon-check class="text-green-600" />
                        {{ $t("model.builtinDesc") }}
                    </div>
                    <div>
                        <a-button class="ml-2" @click="doUser">
                            {{ $t("common.recharge") }}
                        </a-button>
                    </div>
                </div>
                <div class="mb-3">
                    <div class="mb-2 font-bold">{{ $t("model.model") }}</div>
                    <div class="mb-2 text-sm text-gray-400" v-if="provider.id !== 'buildIn'">
                        {{ $t("common.view") }}
                        <a :href="provider?.websites.docs" target="_blank" class="text-blue-600">
                            {{ provider.title }}
                            {{ $t("common.docs") }}
                        </a>
                        {{ $t("common.and") }}
                        <a :href="provider?.websites.models" target="_blank" class="text-blue-600">
                            {{ provider.title }}
                            {{ $t("model.list") }}
                        </a>
                        {{ $t("common.moreDetails") }}
                    </div>
                    <div v-for="g in providerModelGroups" :key="provider.id + g.group" class="mb-2">
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
                                        <div class="flex-grow">
                                            {{ m.name }}
                                        </div>
                                        <div class="flex items-center">
                                            <a-switch
                                                v-if="provider.id !== 'buildIn'"
                                                :model-value="m.enabled"
                                                @change="modelStore.changeModel(provider.id, m.id, 'enabled', $event)"
                                                class="mr-2"
                                            ></a-switch>
                                            <a-button
                                                @click="modelEdit?.show(m)"
                                                v-if="provider.id !== 'buildIn'"
                                                class="mr-2"
                                            >
                                                <template #icon>
                                                    <icon-settings/>
                                                </template>
                                            </a-button>
                                            <a-button
                                                @click="modelStore.modelDelete(provider.id, m.id)"
                                                v-if="provider.id !== 'buildIn'"
                                            >
                                                <template #icon>
                                                    <icon-delete/>
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
                                <icon-plus/>
                            </template>
                            {{ $t("common.add") }}
                        </a-button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <ProviderAddDialog ref="providerAdd"/>
    <ProviderEditDialog ref="providerEdit"/>
    <ModelAddDialog ref="modelAdd" :provider="provider"/>
    <ModelEditDialog ref="modelEdit" :provider="provider"/>
    <ProviderTestDialog ref="providerTest" :provider="provider"/>
</template>
