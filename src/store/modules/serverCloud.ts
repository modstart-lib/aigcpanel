import { defineStore } from "pinia";
import { buildServerContent } from "../../lib/aigcpanel";
import { wait } from "../../lib/util";
import {
    EnumServerStatus,
    EnumServerType,
    ServerRecord,
} from "../../types/Server";
import store from "../index";

export type VideoTemplateCloudRecord = {
    id: string;
    tags: string[];
    title: string;
    cover: string;
};

export type ServerCloudRecord = {
    logo: string;
    url: string;
    demo: any[];
    key: string;
    name: string;
    title: string;
    version: string;
    description: string;
    content: string;
    functions: {
        [key: string]: {
            param: {
                name: string;
                type: string;
                [key: string]: any;
            }[];
        };
    };
    runtime: {
        functions: string[];
        content: string;
    };
};

export const serverCloudStore = defineStore("serverCloud", {
    state: () => ({
        isReady: false,
        /** A cloud catalog request is in flight. */
        loading: false,
        /** Last load error message; empty when the catalog loaded fine. */
        error: "",
        records: [] as ServerCloudRecord[],
        videoTemplateRecords: [] as VideoTemplateCloudRecord[],
    }),
    actions: {
        async waitReady() {
            await wait(() => this.isReady);
        },
        /** 服务端返回的目录记录 -> 带本地字段（key/type/runtime）的云模型记录 */
        mapRecord(r: any): ServerCloudRecord {
            return {
                ...r,
                key: this.generateServerKey(r),
                status: EnumServerStatus.RUNNING,
                type: EnumServerType.CLOUD,
                autoStart: true,
                runtime: {
                    functions: Object.keys(r.functions || {}),
                    content: buildServerContent(r),
                },
            } as ServerCloudRecord;
        },
        /**
         * 本地缓存的云端目录：网络异常时界面仍能显示云模型，
         * 直播主进程（/api/live/tts）也会在拉取失败时回落到这份目录。
         */
        async loadCached() {
            const records = await $mapi.storage.get(
                "serverCloud",
                "records",
                [],
            );
            if (
                !this.records.length &&
                Array.isArray(records) &&
                records.length > 0
            ) {
                this.records = records.map((r: any) => this.mapRecord(r));
            }
        },
        async init() {
            try {
                await this.loadCached();
                await this.refresh();
            } finally {
                this.isReady = true;
            }
        },
        async refresh() {
            if (this.loading) {
                return;
            }
            this.loading = true;
            this.error = "";
            try {
                const res = await $mapi.user.apiPost("server/all", {});
                const records = res?.data?.records;
                const raw = Array.isArray(records) ? records : [];
                this.records = raw.map((r: any) => this.mapRecord(r));
                // 只缓存非空目录，避免接口异常时把可用缓存覆盖成空
                if (raw.length > 0) {
                    await $mapi.storage
                        .set("serverCloud", "records", raw)
                        .catch(() => {});
                }
            } catch (e: any) {
                // Keep the previous records so a transient failure does not
                // make every cloud model disappear from the selectors; the
                // error surfaces as a retry hint instead.
                this.error = String(e?.message || e || "load failed");
            } finally {
                this.loading = false;
            }
        },
        async getByKey(key: string): Promise<ServerRecord | undefined> {
            return this.records.find((record) => record.key === key) as any;
        },
        async getByNameVersion(
            name: string,
            version: string,
        ): Promise<ServerRecord | undefined> {
            return this.records.find(
                (record) => record.name === name && record.version === version,
            ) as any;
        },
        generateServerKey(serverCloud: ServerRecord) {
            return `${serverCloud.name}|${serverCloud.version}`;
        },
        async listVideoTemplates() {
            const res = await $mapi.user.apiPost(
                "aigcpanel/video_template/all",
                {},
            );
            this.videoTemplateRecords = res.data.records;
        },
        async getVideoTemplate(id: string): Promise<VideoTemplateCloudRecord> {
            const res = await $mapi.user.apiPost(
                "aigcpanel/video_template/get",
                { id },
            );
            return res.data.record;
        },
    },
});

const serverCloud = serverCloudStore(store);
serverCloud.init().then(() => {});

export const useServerCloudStore = () => {
    return serverCloud;
};
