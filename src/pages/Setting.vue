<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from "vue";
import {t} from "../lang";
import {TabContentScroller} from "../lib/ui";
import SettingBasic from "../components/Setting/SettingBasic.vue";
import SettingEnv from "../components/Setting/SettingEnv.vue";
import SettingAbout from "../components/Setting/SettingAbout.vue";
import {LiveBlackWordContent} from "./Live/config/blackWord";
import {LiveReplyGenerateContent} from "./Live/config/replyGenerate";
import {
    SoundAsrResultOptimizedPrompt,
    SoundGenerateTextFormItems,
    SoundGenerateTextPrompt
} from "./Sound/config/prompt";
import {SoundGenerateReplaceContent} from "./Sound/config/replaceContent";
import DataConfigDialogButton from "../components/common/DataConfigDialogButton.vue";
import ModelPromptDataConfigButton from "../module/Model/ModelPromptDataConfigButton.vue";

let tabContentScroller: TabContentScroller | null = null;
const contentContainer = ref<HTMLElement | null>(null);
const tabContainer = ref<HTMLElement | null>(null);
onMounted(() => {
    tabContentScroller = new TabContentScroller(
        tabContainer.value as HTMLElement,
        contentContainer.value as HTMLElement,
        {
            activeClass: "menu-active",
        }
    );
});
onBeforeUnmount(() => {
    tabContentScroller?.destroy();
});
</script>

<style lang="less" scoped>
.menu-active {
    --tw-bg-opacity: 1;
    background-color: rgb(243 244 246 / var(--tw-bg-opacity));
}

[data-theme="dark"] {
    .menu-active {
        background-color: var(--color-bg-page-nav-active);
    }
}
</style>

<template>
    <div class="flex select-none bg-white">
        <div
            ref="tabContainer"
            class="p-6 w-56 flex-shrink-0 border-r border-solid border-gray-100 dark:border-gray-600"
        >
            <div data-section="basic" class="p-2 rounded-lg mb-4 cursor-pointer menu-active">
                <div class="text-base">
                    <icon-settings/>
                    {{ t("setting.basic") }}
                </div>
            </div>
            <div data-section="data" class="p-2 rounded-lg mb-4 cursor-pointer">
                <div class="text-base">
                    <icon-tool/>
                    {{ t("setting.dataConfig") }}
                </div>
            </div>
            <div data-section="env" class="p-2 rounded-lg mb-4 cursor-pointer">
                <div class="text-base">
                    <icon-code/>
                    {{ t("setting.env") }}
                </div>
            </div>
            <div data-section="about" class="p-2 rounded-lg mb-4 cursor-pointer">
                <div class="text-base">
                    <icon-user/>
                    {{ t("about.software") }}
                </div>
            </div>
        </div>
        <div class="flex-grow">
            <div
                ref="contentContainer"
                class="overflow-y-auto p-8 leading-8"
                style="height: calc(100vh - var(--window-header-height))"
            >
                <div data-section="basic" class="scroll-mt-4">
                    <div class="text-base font-bold mb-4">{{ t("setting.basic") }}</div>
                    <div>
                        <SettingBasic/>
                    </div>
                </div>
                <div class="border-b border-solid border-gray-200 my-6"></div>
                <div data-section="data" class="scroll-mt-4">
                    <div class="text-base font-bold mb-4">{{ t("setting.dataConfig") }}</div>
                    <div>
                        <div class="flex gap-1">
                            <DataConfigDialogButton
                                title="直播违规词"
                                name="LiveBlackWordContent"
                                placeholder="多个词语请用英文逗号分隔"
                                :default-value="LiveBlackWordContent"
                            />
                            <ModelPromptDataConfigButton
                                title="直播回复生成提示词"
                                name="LiveReplyGenerateContent"
                                prompt-placeholder="支持使用变量：{reply}"
                                :default-prompt="LiveReplyGenerateContent"
                                :param="{reply:'示例回复内容',count: '数量'}"
                            />
                            <ModelPromptDataConfigButton
                                title="ASR结果优化提示词"
                                name="SoundReplaceAsrResultOptimizedPrompt"
                                prompt-placeholder="支持使用变量：{content}"
                                :default-prompt="SoundAsrResultOptimizedPrompt"
                                :param="{content:'识别结果内容'}"
                            />
                            <DataConfigDialogButton
                                title="声音合成优化"
                                name="SoundGenerateReplaceContent"
                                help="声音合成时会自动把文本中的“键”替换为“值”，可用于修正发音"
                                :default-value="SoundGenerateReplaceContent"/>
                            <ModelPromptDataConfigButton
                                title="声音合成内容生成"
                                name="SoundGenerateTextPrompt"
                                :param="SoundGenerateTextFormItems.map(i => ({name: i.name, label: i.label}))"
                                :default-prompt="SoundGenerateTextPrompt"/>
                        </div>
                    </div>
                </div>
                <div class="border-b border-solid border-gray-200 my-6"></div>
                <div data-section="env" class="scroll-mt-4">
                    <div class="text-base font-bold mb-4">{{ t("setting.env") }}</div>
                    <div>
                        <SettingEnv/>
                    </div>
                </div>
                <div class="border-b border-solid border-gray-200 my-6 dark:border-gray-700"></div>
                <div data-section="about" class="scroll-mt-4">
                    <div class="text-base font-bold mb-4">
                        {{ t("about.software") }}
                    </div>
                    <div class="">
                        <SettingAbout/>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
