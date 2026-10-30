import { defineStore } from "pinia";
import { computed } from "vue";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import { mapError } from "../../lib/error";
import { ObjectUtil } from "../../lib/util";
import { LiveAvatarService } from "../../service/LiveAvatarService";
import { liveVoiceProviderName } from "../../service/VoiceService";
import { StorageService } from "../../service/StorageService";
import { LiveStatusType } from "../../types/Live";
import type { LiveMaterialProblemType } from "../../types/Live";
import { EnumServerStatus, ServerRecord } from "../../types/Server";
import store from "../index";
import { useServerStore } from "./server";

const serverStore = useServerStore();

export const liveModels = [
    { value: "wav2lip", title: t("live.wav2lipStandard") },
    { value: "wav2lip384", title: t("live.wav2lipHQ") },
];

const SCENE_ID = "live";
const EMPTY_LIVE_STATUS = {
    id: SCENE_ID,
    status: "stopped",
    statusMsg: "",
    avatar: {
        enable: false,
        width: 0,
        height: 0,
    },
    video: {
        enable: false,
        width: 0,
        height: 0,
    },
    audio: {
        enable: false,
    },
    avatars: [] as {
        id: string;
        title: string;
        url: string;
        status: "init";
        statusMsg: "";
    }[],
    videoTitle: "",
    talkTitle: "",
    talkContent: "",
    /** 手动输入（动态打字）播报的队列，由直播服务返回 */
    talkQueue: [] as {
        id: string;
        content: string;
        status: "synthesizing" | "waiting" | "playing" | "failed";
    }[],
    avatarRtmp: "",
    avatarHls: "",
    videoRtmp: "",
    videoHls: "",
    audioRtmp: "",
    audioHls: "",
    runtime: {
        avatarStatus: "",
        avatarVideoFps: 0,
        avatarAudioFps: 0,
        videoStatus: "",
        videoVideoFps: 0,
        videoAudioFps: 0,
        audioStatus: "",
        audioFps: 0,
    },
};

export const liveStore = defineStore("live", {
    state: () => ({
        server: computed(() => {
            return serverStore.records.find((item) =>
                item.functions.includes("live"),
            ) as ServerRecord | undefined;
        }) as any,
        available: computed(() => {
            const server = serverStore.records.find((item) =>
                item.functions.includes("live"),
            ) as ServerRecord | undefined;
            return server && server.status === EnumServerStatus.RUNNING;
        }),
        serverConfig: {
            ttsProviders: [] as {
                name: string;
                title: string;
                param: {
                    name: string;
                    type: string;
                    title: string;
                    [key: string]: any;
                }[];
                setting: {
                    [key: string]: any;
                };
            }[],
        },
        localConfig: {
            model: "wav2lip" as (typeof liveModels)[number]["value"],
            mode: "avatar" as "avatar" | "audio",
            avatar: {
                width: 720,
                height: 720,
                avatarId: 0,
            },
            audio: {},
            video: {
                enable: false,
                width: 1280,
                height: 800,
            },
            config: {
                flowVideoMode: "order" as "order" | "random",
                flowTalkMode: "order" as "order" | "random",
                flowTalkDelayMin: 5,
                flowTalkDelayMax: 10,
                ttsProvider: "",
                ttsProviderParam: {} as {
                    [key: string]: any;
                },
                ttsProviderSetting: {} as {
                    [key: string]: any;
                },
                /** 直播音色 id（音色管理中选择），为空时回退 ttsProvider */
                voiceId: 0,
                eventDefaultUsername: "宝子",
                eventEnterIgnoreSecond: 120,
                liveMonitorType: "douyin",
                liveMonitorUrl: "",
            },
        },
        status: "stopped" as LiveStatusType,
        statusMsg: "",
        liveStatusTimer: undefined as any,
        liveStatus: ObjectUtil.clone(EMPTY_LIVE_STATUS),
        liveRuntime: {
            liveMonitorEvent: null as any,
        },
        liveDataUpdateTimer: undefined as any,
    }),
    getters: {
        // 直播服务使用的 TTS provider：优先使用音色管理中选择的音色，
        // 未选择音色时回退到旧的声音驱动配置
        activeTtsProvider(state): string {
            if (state.localConfig.config.voiceId) {
                return liveVoiceProviderName(state.localConfig.config.voiceId);
            }
            return state.localConfig.config.ttsProvider;
        },
        activeTtsProviderParam(state): Record<string, any> {
            if (state.localConfig.config.voiceId) {
                return {};
            }
            return state.localConfig.config.ttsProviderParam;
        },
        activeTtsProviderSetting(state): Record<string, any> {
            if (state.localConfig.config.voiceId) {
                return { voiceId: state.localConfig.config.voiceId };
            }
            return state.localConfig.config.ttsProviderSetting;
        },
    },
    actions: {
        async init() {
            const localConfig = await $mapi.storage.get("live", "config", {});
            // console.log('live.init', localConfig)
            this.localConfig.model =
                localConfig.model || this.localConfig.model;
            this.localConfig.mode = localConfig.mode || this.localConfig.mode;
            this.localConfig.avatar.width =
                localConfig.avatar?.width || this.localConfig.avatar.width;
            this.localConfig.avatar.height =
                localConfig.avatar?.height || this.localConfig.avatar.height;
            this.localConfig.avatar.avatarId =
                localConfig.avatar?.avatarId ||
                this.localConfig.avatar.avatarId;
            this.localConfig.video.enable =
                localConfig.video?.enable || this.localConfig.video.enable;
            this.localConfig.video.width =
                localConfig.video?.width || this.localConfig.video.width;
            this.localConfig.video.height =
                localConfig.video?.height || this.localConfig.video.height;
            this.localConfig.config.flowVideoMode =
                localConfig.config?.flowVideoMode ||
                this.localConfig.config.flowVideoMode;
            this.localConfig.config.flowTalkMode =
                localConfig.config?.flowTalkMode ||
                this.localConfig.config.flowTalkMode;
            this.localConfig.config.flowTalkDelayMin =
                localConfig.config?.flowTalkDelayMin ||
                this.localConfig.config.flowTalkDelayMin;
            this.localConfig.config.flowTalkDelayMax =
                localConfig.config?.flowTalkDelayMax ||
                this.localConfig.config.flowTalkDelayMax;
            this.localConfig.config.ttsProvider =
                localConfig.config?.ttsProvider ||
                this.localConfig.config.ttsProvider;
            this.localConfig.config.ttsProviderParam =
                localConfig.config?.ttsProviderParam ||
                this.localConfig.config.ttsProviderParam;
            this.localConfig.config.ttsProviderSetting =
                localConfig.config?.ttsProviderSetting ||
                this.localConfig.config.ttsProviderSetting;
            this.localConfig.config.voiceId =
                localConfig.config?.voiceId || this.localConfig.config.voiceId;
            this.localConfig.config.eventDefaultUsername =
                localConfig.config?.eventDefaultUsername ||
                this.localConfig.config.eventDefaultUsername;
            this.localConfig.config.eventEnterIgnoreSecond =
                localConfig.config?.eventEnterIgnoreSecond ||
                this.localConfig.config.eventEnterIgnoreSecond;
            this.localConfig.config.liveMonitorType =
                localConfig.config?.liveMonitorType ||
                this.localConfig.config.liveMonitorType;
            this.localConfig.config.liveMonitorUrl =
                localConfig.config?.liveMonitorUrl ||
                this.localConfig.config.liveMonitorUrl;
            await this.statusUpdate();
        },
        async saveLocalConfig() {
            await $mapi.storage.set(
                "live",
                "config",
                ObjectUtil.clone(this.localConfig),
            );
        },
        async onKnowledgeUpdate() {
            if (this.status !== "running") {
                return;
            }
            Dialog.tipSuccess(t("live.knowledgeUpdateHint"));
            if (this.liveDataUpdateTimer) {
                clearTimeout(this.liveDataUpdateTimer);
            }
            this.liveDataUpdateTimer = setTimeout(async () => {
                await this.update();
            }, 5 * 1000);
        },
        async statusUpdate() {
            // console.log('update live', JSON.stringify(this.server))
            if (this.liveStatusTimer) {
                clearTimeout(this.liveStatusTimer);
            }
            if (!this.server) {
                if (this.status !== "stopped") {
                    this.status = "stopped";
                    this.liveStatus = ObjectUtil.clone(EMPTY_LIVE_STATUS);
                }
                this.liveStatusTimer = setTimeout(this.statusUpdate, 2000);
                return;
            }
            // console.log('server', {
            //     serverInfo,
            //     server: ObjectUtil.clone(this.server),
            // })
            if (this.server.status !== EnumServerStatus.RUNNING) {
                this.liveStatus = ObjectUtil.clone(EMPTY_LIVE_STATUS);
                this.liveStatusTimer = setTimeout(this.statusUpdate, 2000);
                return;
            }
            const res = await this.apiRequest("status", {});
            // console.log('res', JSON.stringify(res, null, 2))
            if (res.code) {
                this.liveStatusTimer = setTimeout(this.statusUpdate, 2000);
                return;
            }
            const data = res.data.scenes[0] || null;

            if (data) {
                this.liveStatus.id = data.id || SCENE_ID;
                this.liveStatus.status = data.status || "stopped";
                this.liveStatus.statusMsg = data.statusMsg || "";
                this.liveStatus.avatar.enable = data.avatar.enable;
                this.liveStatus.avatar.width = data.avatar.width;
                this.liveStatus.avatar.height = data.avatar.height;
                this.liveStatus.video.enable = data.video.enable;
                this.liveStatus.video.width = data.video.width;
                this.liveStatus.video.height = data.video.height;
                this.liveStatus.audio.enable = data.audio.enable;
                this.liveStatus.videoTitle = data.videoTitle;
                this.liveStatus.talkTitle = data.talkTitle;
                this.liveStatus.talkContent = data.talkContent;
                this.liveStatus.talkQueue = data.talkQueue || [];
                this.liveStatus.avatarRtmp = data.avatarRtmp || "";
                this.liveStatus.avatarHls = data.avatarHls || "";
                this.liveStatus.videoRtmp = data.videoRtmp || "";
                this.liveStatus.videoHls = data.videoHls || "";
                this.liveStatus.audioRtmp = data.audioRtmp || "";
                this.liveStatus.audioHls = data.audioHls || "";
                this.liveStatus.runtime.avatarStatus =
                    data.runtime.avatarStatus || "";
                this.liveStatus.runtime.avatarVideoFps =
                    data.runtime.avatarVideoFps || 0;
                this.liveStatus.runtime.avatarAudioFps =
                    data.runtime.avatarAudioFps || 0;
                this.liveStatus.runtime.videoStatus =
                    data.runtime.videoStatus || "";
                this.liveStatus.runtime.videoVideoFps =
                    data.runtime.videoVideoFps || 0;
                this.liveStatus.runtime.videoAudioFps =
                    data.runtime.videoAudioFps || 0;
                this.liveStatus.runtime.audioStatus =
                    data.runtime.audioStatus || "";
                this.liveStatus.runtime.audioFps = data.runtime.audioFps || 0;
            } else {
                this.liveStatus = ObjectUtil.clone(EMPTY_LIVE_STATUS);
            }
            if (this.liveStatus.status === "stopped") {
                this.status = "stopped";
            } else if (this.liveStatus.status === "running") {
                this.status = "running";
            }
            // 队列中有待合成/待播报的手动内容时加快轮询，让状态变化及时可见
            const nextDelay =
                this.liveStatus.talkQueue.length > 0 ? 1000 : 5000;
            this.liveStatusTimer = setTimeout(this.statusUpdate, nextDelay);
        },
        async apiRequest(
            url: string,
            param: {
                [key: string]: any;
            } = {},
        ) {
            if (!this.server) {
                return {
                    code: -1,
                    msg: t("error.noLiveServerAvailable"),
                    data: {},
                } as ServerCallFunctionResult;
            }
            const serverInfo = await serverStore.serverInfo(this.server);
            return await $mapi.server.callFunctionWithException(
                serverInfo,
                "apiRequest",
                {
                    id: "live",
                    result: {},
                    url,
                    param,
                },
            );
        },
        async configUpdate() {
            const res = await this.apiRequest("config", {});
            let ttsProviders: any[] = [];
            if (0 === res.code) {
                ttsProviders = res.data.ttsProviders;
            }
            for (const server of serverStore.records) {
                if (server.status !== EnumServerStatus.RUNNING) {
                    continue;
                }
                if (!["server-live-indextts"].includes(server.name)) {
                    continue;
                }
                const res = await $mapi.server.config(
                    await serverStore.serverInfo(server),
                );
                if (res.code) {
                    Dialog.tipError(mapError(res.msg));
                    continue;
                }
                const setting = {};
                if (res.data.httpUrl) {
                    setting["httpUrl"] = res.data.httpUrl;
                }
                const config = res.data;
                let param = [];
                if ("soundTts" in config.functions) {
                    param = config.functions.soundTts.param || [];
                } else if ("soundClone" in config.functions) {
                    param = config.functions.soundClone.param || [];
                }
                ttsProviders.push({
                    name: server.name,
                    title: server.title,
                    param: param,
                    setting: setting,
                });
            }
            // console.log('ttsProviders', ttsProviders)
            this.serverConfig.ttsProviders = ttsProviders;
        },
        /**
         * 统计已启用的循环素材数量。
         * 用于开始直播前的校验，以及配置页里「循环口播 / 循环内容视频」的状态提示。
         */
        async knowledgeMaterialCounts() {
            const list = await StorageService.list("LiveKnowledge");
            const counts = {
                flowTalk: 0,
                flowVideo: 0,
            };
            for (const record of list) {
                if (!record.content.enable) {
                    continue;
                }
                if (record.content.type === "flowTalk") {
                    counts.flowTalk++;
                } else if (record.content.type === "flowVideo") {
                    counts.flowVideo++;
                }
            }
            return counts;
        },
        /**
         * 检查开始直播所需的素材，按缺失项返回，顺序即处理优先级。
         * 启动前用它给出具体提示和跳转入口，而不是用一句含糊的报错打断用户。
         */
        async materialCheck(): Promise<{
            counts: { flowTalk: number; flowVideo: number };
            problems: LiveMaterialProblemType[];
        }> {
            const problems: LiveMaterialProblemType[] = [];
            if (!this.localConfig.config.voiceId) {
                problems.push("voice");
            }
            if (this.localConfig.mode === "avatar") {
                const liveAvatar = this.localConfig.avatar.avatarId
                    ? await LiveAvatarService.get(
                          this.localConfig.avatar.avatarId,
                      )
                    : null;
                if (!liveAvatar) {
                    problems.push("avatar");
                }
            }
            const counts = await this.knowledgeMaterialCounts();
            if (!counts.flowTalk) {
                problems.push("flowTalk");
            }
            if (this.localConfig.video.enable && !counts.flowVideo) {
                problems.push("flowVideo");
            }
            return { counts, problems };
        },
        async buildData() {
            const avatars: any[] = [];
            if (this.localConfig.mode === "avatar") {
                const liveAvatar = await LiveAvatarService.get(
                    this.localConfig.avatar.avatarId,
                );
                if (!liveAvatar) {
                    throw new Error(t("live.noAvatarSelected"));
                }
                avatars.push({
                    id: "Avatar" + liveAvatar.id,
                    title: liveAvatar.name,
                    url: liveAvatar.video,
                });
            }
            // 只读取一次知识库，避免多次读取之间数据不一致
            const knowledgeList = (
                await StorageService.list("LiveKnowledge")
            ).filter((s) => {
                return s.content.enable;
            });
            const flowVideos: any[] = [];
            if (this.localConfig.video.enable) {
                for (const s of knowledgeList) {
                    if (s.content.type !== "flowVideo") {
                        continue;
                    }
                    flowVideos.push({
                        id: "FlowVideo" + s.id,
                        title: s.title,
                        video: s.content.url,
                    });
                }
                if (flowVideos.length === 0) {
                    throw new Error(t("live.materialMissingFlowVideo"));
                }
            }
            const flowTalks: any[] = [];
            for (const s of knowledgeList) {
                if (s.content.type !== "flowTalk") {
                    continue;
                }
                s.content.replies = s.content.replies.map((r) => {
                    return {
                        value: r.value,
                    };
                });
                flowTalks.push({
                    id: "FlowTalk" + s.id,
                    title: s.title,
                    talks: [{ value: s.content.reply }, ...s.content.replies],
                    video: s.content.url,
                });
            }
            if (flowTalks.length === 0) {
                throw new Error(t("live.materialMissingFlowTalk"));
            }
            const users: any[] = [];
            const systems: any[] = [];
            for (const s of knowledgeList) {
                s.content.replies = s.content.replies.map((r) => {
                    return {
                        value: r.value,
                    };
                });
                if (s.content.type === "user") {
                    users.push({
                        id: "User" + s.id,
                        title: s.title,
                        talks: [
                            { value: s.content.reply },
                            ...s.content.replies,
                        ],
                        keywords: s.content.keywords,
                        video: s.content.url,
                    });
                } else if (s.content.type === "system") {
                    systems.push({
                        id: "System" + s.id,
                        title: s.title,
                        talks: [
                            { value: s.content.reply },
                            ...s.content.replies,
                        ],
                        systemType: s.content.systemType,
                        video: s.content.url,
                    });
                }
            }
            return { avatars, flowVideos, flowTalks, users, systems };
        },
        async update() {
            // 直播进行中素材可能被清空（例如停用了全部循环口播），
            // 此时保留直播继续运行，只提示哪类素材缺失，避免静默失败。
            let data: any = null;
            try {
                data = await this.buildData();
            } catch (e) {
                Dialog.tipError(
                    t("live.knowledgeUpdateSkipped", {
                        reason: mapError(e),
                    }),
                );
                return;
            }
            const configPost = {
                id: SCENE_ID,
                config: {
                    flowVideoMode: this.localConfig.config.flowVideoMode,
                    flowTalkMode: this.localConfig.config.flowTalkMode,
                    flowTalkDelayMin: this.localConfig.config.flowTalkDelayMin,
                    flowTalkDelayMax: this.localConfig.config.flowTalkDelayMax,
                },
                data,
            };
            const res = await this.apiRequest("scene/update", {
                scene: ObjectUtil.clone(configPost),
            });
            if (res.code) {
                Dialog.tipError(t("error.updateFailed") + ":" + res.msg);
            } else {
                Dialog.tipSuccess(t("live.knowledgeUpdated"));
            }
        },
        async start() {
            await this.saveLocalConfig();
            // console.log('live.start', this.localConfig)
            const configPost = {
                id: SCENE_ID,
                model: this.localConfig.model,
                avatar: {
                    enable: this.localConfig.mode === "avatar",
                    width: this.localConfig.avatar.width,
                    height: this.localConfig.avatar.height,
                },
                audio: {
                    enable: this.localConfig.mode === "audio",
                },
                video: {
                    enable: this.localConfig.video.enable,
                    width: this.localConfig.video.width,
                    height: this.localConfig.video.height,
                },
                config: {
                    flowVideoMode: this.localConfig.config.flowVideoMode,
                    flowTalkMode: this.localConfig.config.flowTalkMode,
                    flowTalkDelayMin: this.localConfig.config.flowTalkDelayMin,
                    flowTalkDelayMax: this.localConfig.config.flowTalkDelayMax,
                    ttsProvider: this.activeTtsProvider,
                    ttsProviderParam: this.activeTtsProviderParam,
                    ttsProviderSetting: this.activeTtsProviderSetting,
                    eventDefaultUsername:
                        this.localConfig.config.eventDefaultUsername,
                    eventEnterIgnoreSecond:
                        this.localConfig.config.eventEnterIgnoreSecond,
                },
                data: await this.buildData(),
            };
            const configPostContent = JSON.stringify(configPost, null, 2);
            await $mapi.file.write("data-live-last.json", configPostContent);
            this.status = "starting";
            this.statusMsg = "";
            const res = await this.apiRequest("scene/start", {
                scene: ObjectUtil.clone(configPost),
            });
            if (res.code) {
                this.status = "error";
                this.statusMsg = res.msg;
                Dialog.tipError(t("service.startFailed") + ":" + res.msg);
                return;
            }
        },
        async stop() {
            this.status = "stopping";
            const res = await this.apiRequest("scene/stop", {
                sceneId: SCENE_ID,
            });
            // console.log('live.stop', res)
            if (res.code) {
                this.status = "error";
                this.statusMsg = res.msg;
                Dialog.tipError(t("common.stopFailed") + ":" + res.msg);
                return;
            }
            this.statusMsg = "";
        },
        /**
         * 动态打字播报：把文字交给直播服务，服务端先合成语音再插入播报队列。
         * 失败时抛出异常，由调用方展示错误。
         */
        async talk(text: string) {
            const res = await this.apiRequest("scene/talk", {
                sceneId: SCENE_ID,
                data: { text },
            });
            if (res.code) {
                throw new Error(res.msg || t("common.sendFailed"));
            }
            return res.data || {};
        },
        fireEvent(type, data) {
            this.apiRequest("scene/event", { sceneId: SCENE_ID, type, data });
        },
        onMonitorBroadcast(data: any) {
            // console.log('MonitorEvent', JSON.stringify(data))
            this.liveRuntime.liveMonitorEvent = data;
            // {"type":"Comment","data":{"source":"douyin","username":"老*****","content":"111"}}
            StorageService.add("LiveEvent", {
                title: data.type,
                content: data.data,
            });
            if (data.type === "Enter") {
                this.fireEvent("Enter", {
                    username: data.data.username,
                });
            } else if (data.type === "Like") {
                this.fireEvent("Like", {
                    username: data.data.username,
                });
            } else if (data.type === "Comment") {
                this.fireEvent("Comment", {
                    content: data.data.content,
                    username: data.data.username,
                });
            }
        },
        async startMonitor() {
            if (!this.localConfig.config.liveMonitorUrl) {
                Dialog.tipError(t("live.setLiveRoomAddressFirst"));
                return;
            }
            await this.saveLocalConfig();
            window.__page.offBroadcast("MonitorEvent", this.onMonitorBroadcast);
            window.__page.onBroadcast("MonitorEvent", this.onMonitorBroadcast);
            await $mapi.app.windowOpen("monitor", {
                title: t("live.listeningTitle"),
                width: 1300,
                height: 800,
                url: this.localConfig.config.liveMonitorUrl,
                script: "server/live_monitor_script",
                openDevTools: false,
                broadcastPages: ["main"],
            });
        },
        async stopMonitor() {
            await $mapi.app.windowClose("monitor");
        },
    },
});

const live = liveStore(store);
live.init().then(() => {});

export const useLiveStore = () => {
    return live;
};
