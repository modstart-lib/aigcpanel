import { defineStore } from "pinia";
import store from "../../../store/index";

import { debounce } from "lodash-es";
import { watch } from "vue";
import { AppConfig } from "../../../config";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { mapError } from "../../../lib/error";
import { ObjectUtil, StringUtil } from "../../../lib/util";
import { useUserStore } from "../../../store/modules/user";
import { SystemModels } from "../models";
import { ModelChatResult, ModelProvider } from "../provider/provider";
import {
    getProviderLogo,
    getProviderTitle,
    SystemProviders,
} from "../providers";
import {
    ChatParam,
    Model,
    ModelType,
    modelTypeNormalize,
    modelTypeTitle,
    Provider,
} from "../types";

const userStore = useUserStore();

export type ModelItem = {
    id: string;
    providerId: string;
    providerLogo: string;
    providerTitle: string;
    modelId: string;
    modelName: string;
    modelType: ModelType;
};

watch(
    () => userStore.data,
    (newValue) => {
        model.init().then();
    },
    {
        deep: true,
    },
);

const mapModelError = (e: any, provider: Provider) => {
    
    return mapError(e);
};

export const modelStore = defineStore("model", {
    state() {
        return {
            providers: [] as Provider[],
        };
    },
    actions: {
        async init() {
            const results: Provider[] = [];
            for (const providerId in SystemProviders) {
                const provider = SystemProviders[providerId];
                results.push({
                    id: providerId,
                    type: "openai",
                    title: getProviderTitle(providerId),
                    logo: getProviderLogo(providerId),
                    isSystem: true,
                    apiUrl: provider.api.url,
                    apiPath: provider.api.path,
                    websites: {
                        official: provider.websites?.official || "",
                        docs: provider.websites?.docs || "",
                        models: provider.websites?.models || "",
                    },
                    data: {
                        apiKey: "",
                        apiHost: "",
                        models: (SystemModels[providerId] || []).map((m) => {
                            return {
                                id: m.id,
                                provider: providerId,
                                name: m.name,
                                group: m.group,
                                type: modelTypeNormalize((m as any).type),
                                caps: (m as any).caps || {},
                                enabled: false,
                            } as any;
                        }),
                        enabled: false,
                    },
                });
            }
            let buildInProviderData: any = null;
            const storageData = await $mapi.storage.read("models");
            if (storageData) {
                if (storageData.userProviders) {
                    storageData.userProviders.forEach((provider) => {
                        results.unshift({
                            id: provider.id,
                            type: provider.type,
                            title: provider.title,
                            logo: null,
                            isSystem: false,
                            apiUrl: "",
                            websites: {
                                official: "",
                                docs: "",
                                models: "",
                            },
                            data: {
                                apiKey: "",
                                apiHost: "",
                                models: [],
                                enabled: false,
                            },
                        });
                    });
                }
                if (storageData.providerData) {
                    buildInProviderData =
                        storageData.providerData["buildIn"] || null;
                    for (const providerId in storageData.providerData) {
                        const provider = results.find(
                            (p) => p.id === providerId,
                        );
                        if (provider) {
                            provider.data.apiKey =
                                storageData.providerData[providerId].apiKey ||
                                "";
                            provider.data.apiHost =
                                storageData.providerData[providerId].apiHost;
                            (
                                storageData.providerData[providerId].models ||
                                []
                            ).forEach((model) => {
                                const existingModel = provider.data.models.find(
                                    (m) => m.id === model.id,
                                );
                                if (existingModel) {
                                    existingModel.name = model.name;
                                    existingModel.group = model.group;
                                    if ("type" in model) {
                                        existingModel.type = modelTypeNormalize(
                                            model.type,
                                        );
                                    }
                                    if ("caps" in model) {
                                        existingModel.caps = model.caps || {};
                                    }
                                    existingModel.enabled =
                                        model.enabled || false;
                                } else {
                                    provider.data.models.push({
                                        id: model.id,
                                        provider: providerId,
                                        name: model.name,
                                        group: model.group,
                                        type: modelTypeNormalize(model.type),
                                        caps: model.caps || {},
                                        enabled: model.enabled || false,
                                        editable: true,
                                    });
                                }
                            });
                            provider.data.enabled =
                                storageData.providerData[providerId].enabled ||
                                false;
                        }
                    }
                }
            }
            this.providers = results;
            
        },
        async enabledModels(type?: ModelType): Promise<ModelItem[]> {
            const results: ModelItem[] = [];
            this.providers.forEach((provider) => {
                if (provider.data.enabled) {
                    provider.data.models.forEach((model) => {
                        const modelType = modelTypeNormalize(model.type);
                        if (type && modelType !== type) {
                            return;
                        }
                        if (model.enabled) {
                            results.push({
                                id: provider.id + "|" + model.id,
                                providerId: provider.id,
                                providerLogo: provider.logo || "",
                                providerTitle: provider.title || "",
                                modelId: model.id,
                                modelName: model.name,
                                modelType,
                            });
                        }
                    });
                }
            });
            return results;
        },
        async refreshBuildIn(buildInProviderData?: any) {
            
        },
        async add(provider: Partial<Provider>) {
            const p = {
                id: provider.id || StringUtil.random(8),
                type: provider.type,
                title: provider.title,
                logo: null,
                isSystem: false,
                websites: {
                    official: "",
                    docs: "",
                    models: "",
                },
                data: {
                    apiKey: "",
                    apiHost: "",
                    models: [],
                    enabled: false,
                },
            };
            this.providers.unshift(p as any);
            await this.sync();
        },
        async edit(provider: Partial<Provider>) {
            const p = this.providers.find((p) => p.id === provider.id);
            if (p) {
                if ("title" in provider) {
                    p.title = provider.title || "";
                }
                if ("type" in provider) {
                    p.type = provider.type || "openai";
                }
                if (provider.data) {
                    if ("apiKey" in provider.data) {
                        p.data.apiKey = provider.data.apiKey;
                    }
                    if ("apiHost" in provider.data) {
                        p.data.apiHost = provider.data.apiHost;
                    }
                    if ("enabled" in provider.data) {
                        p.data.enabled = provider.data.enabled;
                    }
                }
                await this.sync();
            }
        },
        async test(providerId: string, modelId: string) {
            
            const provider = this.providers.find((p) => p.id === providerId);
            if (!provider) {
                return;
            }
            const m = provider.data.models.find((m) => m.id === modelId);
            if (!m) {
                return;
            }
            const config = {
                type: provider.type,
                modelId: m.id,
                apiUrl: provider.apiUrl,
                apiHost: provider.data.apiHost,
                apiPath: provider.apiPath,
                apiKey: provider.data.apiKey,
            };
            Dialog.loadingOn(t("common.testing"));
            try {
                const ret = await ModelProvider.chat(
                    "你是什么模型，简短回答",
                    { systemPrompt: null },
                    config,
                );
                if (ret.code) {
                    throw ret.msg;
                }
                Dialog.tipSuccess(t("common.testSuccess"));
            } catch (e) {
                Dialog.tipError(
                    t("common.testFailed") + " " + mapModelError(e, provider),
                );
            } finally {
                Dialog.loadingOff();
            }
        },
        /**
         * 解析并校验模型，type 指定调用所需的模型类型
         */
        async resolveModel(
            providerId: string,
            modelId: string,
            type: ModelType,
        ): Promise<{ provider?: Provider; model?: Model; msg?: string }> {
            
            if (!providerId || !modelId) {
                Dialog.tipError(t("hint.selectModel"));
                return { msg: t("hint.selectModel") };
            }
            const provider = this.providers.find((p) => p.id === providerId);
            if (!provider) {
                return { msg: "provider not found" };
            }
            
            const m = provider.data.models.find((m) => m.id === modelId);
            if (!m) {
                return { msg: "model not found" };
            }
            if (modelTypeNormalize(m.type) !== type) {
                const msg = t("model.typeSelectTip", {
                    type: modelTypeTitle(type),
                });
                Dialog.tipError(msg);
                return { msg };
            }
            return { provider: provider as Provider, model: m as Model };
        },
        async chat(
            providerId: string,
            modelId: string,
            prompt: string,
            chatParam: ChatParam,
            option?: {
                loading: boolean;
            },
        ): Promise<ModelChatResult> {
            option = Object.assign(
                {
                    loading: false,
                },
                option,
            );
            const {
                provider,
                model: m,
                msg,
            } = await this.resolveModel(providerId, modelId, "text");
            if (!provider || !m) {
                return { code: -1, msg: msg || "model not found" };
            }
            if (option.loading) {
                Dialog.loadingOn();
            }
            try {
                return await ModelProvider.chat(prompt, chatParam, {
                    type: provider.type,
                    modelId: m.id,
                    apiUrl: provider.apiUrl,
                    apiHost: provider.data.apiHost,
                    apiPath: provider.apiPath,
                    apiKey: provider.data.apiKey,
                });
            } catch (e) {
                return { code: -1, msg: mapModelError(e, provider) };
            } finally {
                if (option.loading) {
                    Dialog.loadingOff();
                }
            }
        },
        async change(
            providerId: string,
            key: "" | "data.apiKey" | "data.apiHost" | "data.enabled",
            value: any,
        ) {
            const provider = model.providers.find((p) => p.id === providerId);
            if (!provider) {
                return;
            }
            const keys = key.split(".");
            let obj = provider;
            for (let i = 0; i < keys.length - 1; i++) {
                obj = obj[keys[i]];
            }
            const lastKey = keys[keys.length - 1];
            if (obj && lastKey in obj) {
                obj[lastKey] = value;
            }
            await this.sync();
        },
        async providerDelete(providerId: string) {
            const idx = this.providers.findIndex((p) => p.id === providerId);
            if (idx !== -1) {
                this.providers.splice(idx, 1);
            }
            await this.sync();
        },
        async modelAdd(providerId: string, model: Partial<Model>) {
            const provider = this.providers.find((p) => p.id === providerId);
            if (!provider) {
                return;
            }
            const m = {
                id: model.id,
                provider: providerId,
                name: model.name || "",
                group: model.group || "",
                type: modelTypeNormalize(model.type),
                caps: model.caps || {},
                enabled: true,
            };
            provider.data.models.unshift(m as any);
            await this.sync();
        },
        async modelDelete(providerId: string, modelId: string) {
            const provider = this.providers.find((p) => p.id === providerId);
            if (!provider) {
                return;
            }
            const m = provider.data.models.find((m) => m.id === modelId);
            if (m) {
                provider.data.models.splice(provider.data.models.indexOf(m), 1);
            }
            await this.sync();
        },
        async modelEdit(providerId: string, model: Partial<Model>) {
            const provider = this.providers.find((p) => p.id === providerId);
            if (!provider) {
                return;
            }
            const m = provider.data.models.find((m) => m.id === model.id);
            if (m) {
                if ("name" in model) {
                    m.name = model.name || "";
                }
                if ("group" in model) {
                    m.group = model.group || "";
                }
                if ("type" in model) {
                    m.type = modelTypeNormalize(model.type);
                }
                if ("caps" in model) {
                    m.caps = model.caps || {};
                }
                if ("enabled" in model) {
                    m.enabled = model.enabled as boolean;
                }
            }
            await this.sync();
        },
        async changeModel(
            providerId: string,
            modelId: string,
            key: "enabled",
            value: any,
        ) {
            const provider = this.providers.find((p) => p.id === providerId);
            if (!provider) {
                return;
            }
            const m = provider.data.models.find((m) => m.id === modelId);
            if (m) {
                m[key] = value;
            }
            await this.sync();
        },
        sync: debounce(async () => {
            const providerData = {};
            model.providers.forEach((provider) => {
                providerData[provider.id] = {
                    ...ObjectUtil.clone(provider.data),
                    apiUrl: provider.apiUrl || "",
                };
                if (provider.id === "buildIn") {
                    providerData[provider.id].apiKey = "";
                }
            });
            const userProviders = model.providers.filter(
                (provider) => !provider.isSystem,
            );
            await $mapi.storage.write(
                "models",
                ObjectUtil.clone({ providerData, userProviders }),
            );
        }, 200),
    },
});

export const model = modelStore(store);
model.init().then();

export const useModelStore = () => {
    return model;
};
