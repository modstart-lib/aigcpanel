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
        async init() {
            try {
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
                this.records = (Array.isArray(records) ? records : []).map(
                    (r: any) => {
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
                        };
                    },
                );
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
