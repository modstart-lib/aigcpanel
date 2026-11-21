import packageJson from "../package.json";

// 允许测试/私有部署覆盖接口域名（如本地 mock 服务、自建后端）
const BASE_URL = process.env.AIGCPANEL_API_BASE_URL || "https://aigcpanel.com";

export const AppConfig = {
    name: "AIGCPanel",
    title: "AIGCPanel",
    slogan: "一站式AI数字人系统",
    version: packageJson.version,
    website: `${BASE_URL}`,
    websiteGithub: "https://github.com/modstart-lib/aigcpanel",
    websiteGitee: "https://gitee.com/modstart-lib/aigcpanel",
    apiBaseUrl: `${BASE_URL}/api`,
    updaterUrl: `${BASE_URL}/app_manager/updater/open`,
    downloadUrl: `${BASE_URL}/app_manager/download`,
    feedbackUrl: `${BASE_URL}/feedback_ticket`,
    statisticsUrl: `${BASE_URL}/app_manager/collect`,
    guideUrl: `${BASE_URL}/app_manager/guide`,
    helpUrl: `${BASE_URL}/app_manager/help`,
    serverUrl: `${BASE_URL}/aigcpanel/`,
    basic: {
        userEnable: false,
    },
};
