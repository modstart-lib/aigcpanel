import { t } from "../../lang";

import ZhinaoProviderLogo from "./assets/image/models/360.png";
import HunyuanProviderLogo from "./assets/image/models/hunyuan.png";
import AiHubMixProviderLogo from "./assets/image/providers/aihubmix.jpg";
import AlayaNewProviderLogo from "./assets/image/providers/alayanew.webp";
import AnthropicProviderLogo from "./assets/image/providers/anthropic.png";
import BaichuanProviderLogo from "./assets/image/providers/baichuan.png";
import BaiduCloudProviderLogo from "./assets/image/providers/baidu-cloud.svg";
import BailianProviderLogo from "./assets/image/providers/bailian.png";
import DeepSeekProviderLogo from "./assets/image/providers/deepseek.png";
import DmxapiProviderLogo from "./assets/image/providers/DMXAPI.png";
import FireworksProviderLogo from "./assets/image/providers/fireworks.png";
import GiteeAIProviderLogo from "./assets/image/providers/gitee-ai.png";
import GoogleProviderLogo from "./assets/image/providers/google.png";
import GPUStackProviderLogo from "./assets/image/providers/gpustack.svg";
import GraphRagProviderLogo from "./assets/image/providers/graph-rag.png";
import GrokProviderLogo from "./assets/image/providers/grok.png";
import GroqProviderLogo from "./assets/image/providers/groq.png";
import InfiniProviderLogo from "./assets/image/providers/infini.png";
import LMStudioProviderLogo from "./assets/image/providers/lmstudio.png";
import MinimaxProviderLogo from "./assets/image/providers/minimax.png";
import MistralProviderLogo from "./assets/image/providers/mistral.png";
import ModelScopeProviderLogo from "./assets/image/providers/modelscope.png";
import MoonshotProviderLogo from "./assets/image/providers/moonshot.png";
import NvidiaProviderLogo from "./assets/image/providers/nvidia.png";
import O3ProviderLogo from "./assets/image/providers/o3.png";
import OcoolAiProviderLogo from "./assets/image/providers/ocoolai.png";
import OllamaProviderLogo from "./assets/image/providers/ollama.png";
import OpenAiProviderLogo from "./assets/image/providers/openai.png";
import OpenRouterProviderLogo from "./assets/image/providers/openrouter.png";
import PerplexityProviderLogo from "./assets/image/providers/perplexity.png";
import PPIOProviderLogo from "./assets/image/providers/ppio.png";
import SiliconFlowProviderLogo from "./assets/image/providers/silicon.png";
import StepProviderLogo from "./assets/image/providers/step.png";
import TencentCloudProviderLogo from "./assets/image/providers/tencent-cloud-ti.png";
import TogetherProviderLogo from "./assets/image/providers/together.png";
import BytedanceProviderLogo from "./assets/image/providers/volcengine.png";
import XirangProviderLogo from "./assets/image/providers/xirang.png";
import ZhipuProviderLogo from "./assets/image/providers/zhipu.png";
import { ModelProvider } from "./provider/provider";
import { Provider } from "./types";

const ProviderLogoMap = {
    
    openai: OpenAiProviderLogo,
    silicon: SiliconFlowProviderLogo,
    deepseek: DeepSeekProviderLogo,
    "gitee-ai": GiteeAIProviderLogo,
    groq: GroqProviderLogo,
    zhipu: ZhipuProviderLogo,
    ollama: OllamaProviderLogo,
    lmstudio: LMStudioProviderLogo,
    moonshot: MoonshotProviderLogo,
    openrouter: OpenRouterProviderLogo,
    baichuan: BaichuanProviderLogo,
    dashscope: BailianProviderLogo,
    modelscope: ModelScopeProviderLogo,
    xirang: XirangProviderLogo,
    anthropic: AnthropicProviderLogo,
    aihubmix: AiHubMixProviderLogo,
    gemini: GoogleProviderLogo,
    stepfun: StepProviderLogo,
    doubao: BytedanceProviderLogo,
    "graphrag-kylin-mountain": GraphRagProviderLogo,
    minimax: MinimaxProviderLogo,
    ocoolai: OcoolAiProviderLogo,
    together: TogetherProviderLogo,
    fireworks: FireworksProviderLogo,
    zhinao: ZhinaoProviderLogo,
    nvidia: NvidiaProviderLogo,
    hunyuan: HunyuanProviderLogo,
    grok: GrokProviderLogo,
    mistral: MistralProviderLogo,
    ppio: PPIOProviderLogo,
    "baidu-cloud": BaiduCloudProviderLogo,
    dmxapi: DmxapiProviderLogo,
    perplexity: PerplexityProviderLogo,
    infini: InfiniProviderLogo,
    o3: O3ProviderLogo,
    "tencent-cloud-ti": TencentCloudProviderLogo,
    gpustack: GPUStackProviderLogo,
    alayanew: AlayaNewProviderLogo,
} as const;

export function getProviderLogo(providerId: string) {
    return ProviderLogoMap[providerId as keyof typeof ProviderLogoMap];
}

export function getProviderUrl(provider: Provider) {
    return ModelProvider.apiUrl(
        provider.type,
        provider.apiUrl,
        provider.data.apiHost,
        provider.apiPath,
    );
}

export const getProviderTitle = (providerId: string) => {
    const map: Record<string, string> = {
        
        aihubmix: "AiHubMix",
        alayanew: "Alaya NeW",
        anthropic: "Anthropic",
        baichuan: t("provider.baichuan"),
        "baidu-cloud": t("provider.baiduCloud"),
        dashscope: t("provider.dashscope"),
        deepseek: t("provider.deepseek"),
        dmxapi: "DMXAPI",
        doubao: t("provider.doubao"),
        fireworks: "Fireworks",
        gemini: "Gemini",
        "gitee-ai": "Gitee AI",
        gpustack: "GPUStack",
        "graphrag-kylin-mountain": "GraphRAG",
        grok: "Grok",
        groq: "Groq",
        hunyuan: t("provider.hunyuan"),
        infini: t("provider.infini"),
        lmstudio: "LM Studio",
        minimax: "MiniMax",
        mistral: "Mistral",
        modelscope: t("provider.modelscope"),
        moonshot: t("provider.moonshot"),
        nvidia: t("provider.nvidia"),
        o3: "O3",
        ocoolai: "ocoolAI",
        ollama: "Ollama",
        openai: "OpenAI",
        openrouter: "OpenRouter",
        perplexity: "Perplexity",
        ppio: t("provider.ppio"),
        qwenlm: "QwenLM",
        silicon: t("provider.silicon"),
        stepfun: t("provider.stepfun"),
        "tencent-cloud-ti": t("provider.tencentCloudTi"),
        together: "Together",
        xirang: t("provider.xirang"),
        zhinao: t("provider.zhinao"),
        zhipu: t("provider.zhipu"),
    };
    return map[providerId as keyof typeof map] || providerId;
};

export type SystemProviderConfig = {
    api: {
        url: string;
        /**
         * Api version prefix appended to `url`, `/v1` by default.
         * Use "" when the provider has no version prefix, or a provider specific
         * OpenAI compatible prefix such as `/v1beta/openai`.
         */
        path?: string;
    };
    websites?: {
        official?: string;
        apiKey?: string;
        docs?: string;
        models?: string;
    };
};

export const SystemProviders: Record<string, SystemProviderConfig> = {
    openai: {
        api: {
            url: "https://api.openai.com",
        },
        websites: {
            official: "https://openai.com/",
            apiKey: "https://platform.openai.com/api-keys",
            docs: "https://platform.openai.com/docs",
            models: "https://platform.openai.com/docs/models",
        },
    },
    o3: {
        api: {
            url: "https://api.o3.fan",
        },
        websites: {
            official: "https://o3.fan",
            apiKey: "https://o3.fan/token",
            docs: "https://docs.o3.fan",
            models: "https://docs.o3.fan/models",
        },
    },
    ppio: {
        api: {
            url: "https://api.ppinfra.com/v3/openai",
        },
        websites: {
            official:
                "https://ppinfra.com/model-api/product/llm-api?utm_source=github_cherry-studio&utm_medium=github_readme&utm_campaign=link",
            apiKey: "https://ppinfra.com/settings/key-management",
            docs: "https://ppinfra.com/docs/model-api/reference/llm/llm.html",
            models: "https://ppinfra.com/model-api/product/llm-api?utm_source=github_cherry-studio&utm_medium=github_readme&utm_campaign=link",
        },
    },
    gemini: {
        api: {
            url: "https://generativelanguage.googleapis.com",
            // Gemini exposes an OpenAI compatible layer under this prefix
            path: "/v1beta/openai",
        },
        websites: {
            official: "https://gemini.google.com/",
            apiKey: "https://aistudio.google.com/app/apikey",
            docs: "https://ai.google.dev/gemini-api/docs",
            models: "https://ai.google.dev/gemini-api/docs/models/gemini",
        },
    },
    silicon: {
        api: {
            url: "https://api.siliconflow.cn",
        },
        websites: {
            official: "https://www.siliconflow.cn/",
            apiKey: "https://cloud.siliconflow.cn/account/ak?referrer=clxty1xuy0014lvqwh5z50i88",
            docs: "https://docs.siliconflow.cn/",
            models: "https://cloud.siliconflow.cn/models",
        },
    },
    "gitee-ai": {
        api: {
            url: "https://ai.gitee.com",
        },
        websites: {
            official: "https://ai.gitee.com/",
            apiKey: "https://ai.gitee.com/dashboard/settings/tokens",
            docs: "https://ai.gitee.com/docs/openapi/v1#tag/%E6%96%87%E6%9C%AC%E7%94%9F%E6%88%90/POST/chat/completions",
            models: "https://ai.gitee.com/serverless-api",
        },
    },
    deepseek: {
        api: {
            url: "https://api.deepseek.com",
        },
        websites: {
            official: "https://deepseek.com/",
            apiKey: "https://platform.deepseek.com/api_keys",
            docs: "https://platform.deepseek.com/api-docs/",
            models: "https://platform.deepseek.com/api-docs/",
        },
    },
    ocoolai: {
        api: {
            url: "https://api.ocoolai.com",
        },
        websites: {
            official: "https://one.ocoolai.com/",
            apiKey: "https://one.ocoolai.com/token",
            docs: "https://docs.ocoolai.com/",
            models: "https://api.ocoolai.com/info/models/",
        },
    },
    together: {
        api: {
            url: "https://api.together.xyz",
        },
        websites: {
            official: "https://www.together.ai/",
            apiKey: "https://api.together.ai/settings/api-keys",
            docs: "https://docs.together.ai/docs/introduction",
            models: "https://docs.together.ai/docs/chat-models",
        },
    },
    dmxapi: {
        api: {
            url: "https://www.dmxapi.cn",
        },
        websites: {
            official: "https://www.dmxapi.cn/register?aff=bwwY",
            apiKey: "https://www.dmxapi.cn/register?aff=bwwY",
            docs: "https://dmxapi.cn/models.html#code-block",
            models: "https://www.dmxapi.cn/pricing",
        },
    },
    perplexity: {
        api: {
            url: "https://api.perplexity.ai",
            // Perplexity does not use a version prefix
            path: "",
        },
        websites: {
            official: "https://perplexity.ai/",
            apiKey: "https://www.perplexity.ai/settings/api",
            docs: "https://docs.perplexity.ai/home",
            models: "https://docs.perplexity.ai/guides/model-cards",
        },
    },
    infini: {
        api: {
            url: "https://cloud.infini-ai.com/maas",
        },
        websites: {
            official: "https://cloud.infini-ai.com/",
            apiKey: "https://cloud.infini-ai.com/iam/secret/key",
            docs: "https://docs.infini-ai.com/gen-studio/api/maas.html#/operations/chatCompletions",
            models: "https://cloud.infini-ai.com/genstudio/model",
        },
    },
    zhipu: {
        api: {
            url: "https://open.bigmodel.cn/api/paas/v4/",
        },
        websites: {
            official: "https://open.bigmodel.cn/",
            apiKey: "https://open.bigmodel.cn/usercenter/apikeys",
            docs: "https://open.bigmodel.cn/dev/howuse/introduction",
            models: "https://open.bigmodel.cn/modelcenter/square",
        },
    },
    moonshot: {
        api: {
            url: "https://api.moonshot.cn",
        },
        websites: {
            official: "https://moonshot.ai/",
            apiKey: "https://platform.moonshot.cn/console/api-keys",
            docs: "https://platform.moonshot.cn/docs/",
            models: "https://platform.moonshot.cn/docs/intro#%E6%A8%A1%E5%9E%8B%E5%88%97%E8%A1%A8",
        },
    },
    baichuan: {
        api: {
            url: "https://api.baichuan-ai.com",
        },
        websites: {
            official: "https://www.baichuan-ai.com/",
            apiKey: "https://platform.baichuan-ai.com/console/apikey",
            docs: "https://platform.baichuan-ai.com/docs",
            models: "https://platform.baichuan-ai.com/price",
        },
    },
    modelscope: {
        api: {
            url: "https://api-inference.modelscope.cn/v1",
        },
        websites: {
            official: "https://modelscope.cn",
            apiKey: "https://modelscope.cn/my/myaccesstoken",
            docs: "https://modelscope.cn/docs/model-service/API-Inference/intro",
            models: "https://modelscope.cn/models",
        },
    },
    xirang: {
        api: {
            url: "https://wishub-x1.ctyun.cn",
        },
        websites: {
            official: "https://www.ctyun.cn",
            apiKey: "https://huiju.ctyun.cn/service/serviceGroup",
            docs: "https://www.ctyun.cn/products/ctxirang",
            models: "https://huiju.ctyun.cn/modelSquare/",
        },
    },
    dashscope: {
        api: {
            url: "https://dashscope.aliyuncs.com/compatible-mode/v1/",
        },
        websites: {
            official: "https://www.aliyun.com/product/bailian",
            apiKey: "https://bailian.console.aliyun.com/?apiKey=1#/api-key",
            docs: "https://help.aliyun.com/zh/model-studio/getting-started/",
            models: "https://bailian.console.aliyun.com/model-market#/model-market",
        },
    },
    stepfun: {
        api: {
            url: "https://api.stepfun.com",
        },
        websites: {
            official: "https://platform.stepfun.com/",
            apiKey: "https://platform.stepfun.com/interface-key",
            docs: "https://platform.stepfun.com/docs/overview/concept",
            models: "https://platform.stepfun.com/docs/llm/text",
        },
    },
    doubao: {
        api: {
            url: "https://ark.cn-beijing.volces.com/api/v3/",
        },
        websites: {
            official: "https://console.volcengine.com/ark/",
            apiKey: "https://www.volcengine.com/experience/ark?utm_term=202502dsinvite&ac=DSASUQY5&rc=DB4II4FC",
            docs: "https://www.volcengine.com/docs/82379/1182403",
            models: "https://console.volcengine.com/ark/region:ark+cn-beijing/endpoint",
        },
    },
    minimax: {
        api: {
            url: "https://api.minimaxi.com",
        },
        websites: {
            official: "https://platform.minimaxi.com/",
            apiKey: "https://platform.minimaxi.com/user-center/basic-information/interface-key",
            docs: "https://platform.minimaxi.com/document/Announcement",
            models: "https://platform.minimaxi.com/document/Models",
        },
    },
    alayanew: {
        api: {
            url: "https://deepseek.alayanew.com",
        },
        websites: {
            official:
                "https://www.alayanew.com/backend/register?id=cherrystudio",
            apiKey: " https://www.alayanew.com/backend/register?id=cherrystudio",
            docs: "https://docs.alayanew.com/docs/modelService/interview?utm_source=cherrystudio",
            models: "https://www.alayanew.com/product/deepseek?id=cherrystudio",
        },
    },
    openrouter: {
        api: {
            url: "https://openrouter.ai/api/v1/",
        },
        websites: {
            official: "https://openrouter.ai/",
            apiKey: "https://openrouter.ai/settings/keys",
            docs: "https://openrouter.ai/docs/quick-start",
            models: "https://openrouter.ai/docs/models",
        },
    },
    groq: {
        api: {
            url: "https://api.groq.com/openai",
        },
        websites: {
            official: "https://groq.com/",
            apiKey: "https://console.groq.com/keys",
            docs: "https://console.groq.com/docs/quickstart",
            models: "https://console.groq.com/docs/models",
        },
    },
    ollama: {
        api: {
            url: "http://localhost:11434",
        },
        websites: {
            official: "https://ollama.com/",
            docs: "https://github.com/ollama/ollama/tree/main/docs",
            models: "https://ollama.com/library",
        },
    },
    lmstudio: {
        api: {
            url: "http://localhost:1234",
        },
        websites: {
            official: "https://lmstudio.ai/",
            docs: "https://lmstudio.ai/docs",
            models: "https://lmstudio.ai/models",
        },
    },
    anthropic: {
        api: {
            url: "https://api.anthropic.com",
        },
        websites: {
            official: "https://anthropic.com/",
            apiKey: "https://console.anthropic.com/settings/keys",
            docs: "https://docs.anthropic.com/en/docs",
            models: "https://docs.anthropic.com/en/docs/about-claude/models",
        },
    },
    grok: {
        api: {
            url: "https://api.x.ai",
        },
        websites: {
            official: "https://x.ai/",
            docs: "https://docs.x.ai/",
            models: "https://docs.x.ai/docs#getting-started",
        },
    },
    mistral: {
        api: {
            url: "https://api.mistral.ai",
        },
        websites: {
            official: "https://mistral.ai",
            apiKey: "https://console.mistral.ai/api-keys/",
            docs: "https://docs.mistral.ai",
            models: "https://docs.mistral.ai/getting-started/models/models_overview",
        },
    },
    aihubmix: {
        api: {
            url: "https://aihubmix.com",
        },
        websites: {
            official: "https://aihubmix.com?aff=SJyh",
            apiKey: "https://aihubmix.com?aff=SJyh",
            docs: "https://doc.aihubmix.com/",
            models: "https://aihubmix.com/models",
        },
    },
    fireworks: {
        api: {
            url: "https://api.fireworks.ai/inference",
        },
        websites: {
            official: "https://fireworks.ai/",
            apiKey: "https://fireworks.ai/account/api-keys",
            docs: "https://docs.fireworks.ai/getting-started/introduction",
            models: "https://fireworks.ai/dashboard/models",
        },
    },
    zhinao: {
        api: {
            url: "https://api.360.cn",
        },
        websites: {
            official: "https://ai.360.com/",
            apiKey: "https://ai.360.com/platform/keys",
            docs: "https://ai.360.com/platform/docs/overview",
            models: "https://ai.360.com/platform/limit",
        },
    },
    hunyuan: {
        api: {
            url: "https://api.hunyuan.cloud.tencent.com",
        },
        websites: {
            official: "https://cloud.tencent.com/product/hunyuan",
            apiKey: "https://console.cloud.tencent.com/hunyuan/api-key",
            docs: "https://cloud.tencent.com/document/product/1729/111007",
            models: "https://cloud.tencent.com/document/product/1729/104753",
        },
    },
    nvidia: {
        api: {
            url: "https://integrate.api.nvidia.com",
        },
        websites: {
            official: "https://build.nvidia.com/explore/discover",
            apiKey: "https://build.nvidia.com/meta/llama-3_1-405b-instruct",
            docs: "https://docs.api.nvidia.com/nim/reference/llm-apis",
            models: "https://build.nvidia.com/nim",
        },
    },
    "baidu-cloud": {
        api: {
            url: "https://qianfan.baidubce.com/v2/",
        },
        websites: {
            official: "https://cloud.baidu.com/",
            apiKey: "https://console.bce.baidu.com/iam/#/iam/apikey/list",
            docs: "https://cloud.baidu.com/doc/index.html",
            models: "https://cloud.baidu.com/doc/WENXINWORKSHOP/s/Fm2vrveyu",
        },
    },
    "tencent-cloud-ti": {
        api: {
            url: "https://api.lkeap.cloud.tencent.com",
        },
        websites: {
            official: "https://cloud.tencent.com/product/ti",
            apiKey: "https://console.cloud.tencent.com/lkeap/api",
            docs: "https://cloud.tencent.com/document/product/1772",
            models: "https://console.cloud.tencent.com/tione/v2/aimarket",
        },
    },
    gpustack: {
        api: {
            url: "",
            // GPUStack serves an OpenAI compatible endpoint such as `/v1-openai`
            path: "",
        },
        websites: {
            official: "https://gpustack.ai/",
            docs: "https://docs.gpustack.ai/latest/",
            models: "https://docs.gpustack.ai/latest/overview/#supported-models",
        },
    },
};
