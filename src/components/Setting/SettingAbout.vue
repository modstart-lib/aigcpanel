<script setup lang="ts">
import {AppConfig} from "../../config";
import {t} from "../../lang";
import UpdaterButton from "../common/UpdaterButton.vue";
import {useSettingStore} from "../../store/modules/setting";
import FeedbackTicketButton from "../common/FeedbackTicketButton.vue";

const setting = useSettingStore();
const licenseYear = new Date().getFullYear();

const doOpenLog = async () => {
    await window.$mapi.app.openPath(window.$mapi.log.root());
};
</script>

<template>
    <div class="flex mb-3">
        <div class="w-20">{{ t("common.version") }}</div>
        <div class="flex-grow">
            <div>
                {{ $t("社区版") }}
                v{{ AppConfig.version }} Build {{ setting.buildInfo.buildId }}
            </div>
            <div class="pt-2">
                <UpdaterButton />
            </div>
        </div>
    </div>
    <div class="flex mb-3 items-center">
        <div class="w-20">{{ t("common.officialSite") }}</div>
        <div class="flex-grow flex items-center">
            <a :href="AppConfig.website" target="_blank" class="text-link">
                {{ AppConfig.website }}
            </a>
            <div class="inline-block ml-3">
                <FeedbackTicketButton />
            </div>
            <a-button class="ml-3" size="mini" @click="doOpenLog">
                <template #icon>
                    <icon-file />
                </template>
                {{ t("nav.log") }}
            </a-button>
        </div>
    </div>
    <div class="flex mb-3 items-center">
        <div class="w-20">{{ t("声明") }}</div>
        <div class="flex-grow">
            {{ t("本产品为开源软件，遵循 AGPL-3.0 license 协议。") }}
        </div>
    </div>
    <div class="mb-3">
        <a
            :href="AppConfig.websiteGithub"
            target="_blank"
            class="bg-gray-100 dark:bg-gray-700 w-48 mr-1 rounded-lg py-2 px-8 inline-flex items-center mb-3 hover:shadow-lg"
        >
            <img src="./../../assets/image/github.svg" class="w-12 h-12 mr-2" />
            <div class="flex-grow">Github</div>
        </a>
        <a
            :href="AppConfig.websiteGitee"
            target="_blank"
            class="bg-gray-100 dark:bg-gray-700 w-48 mr-1 rounded-lg py-2 px-8 inline-flex items-center hover:shadow-lg"
        >
            <img src="./../../assets/image/gitee.svg" class="w-12 h-12 mr-2" />
            <div class="flex-grow">Gitee</div>
        </a>
    </div>
    <div class="text-gray-400">&copy; {{ licenseYear }} {{ AppConfig.title }}</div>
</template>
