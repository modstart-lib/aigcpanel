import { defineStore } from "pinia";
import {
    formatBytes,
    formatSpeed,
    sortProbeResults,
    type UpdaterState,
} from "../../lib/updater";
import { t } from "../../lang";

type ProbeResult = {
    title: string;
    url: string;
    ok: boolean;
    latency: number;
    rank: number;
};

const emptyState = (): UpdaterState => ({
    phase: "idle",
    currentVersion: "",
    latestVersion: "",
    release: null,
    asset: null,
    channels: [],
    channel: null,
    progress: 0,
    downloaded: 0,
    total: 0,
    speed: 0,
    filePath: "",
    error: "",
    blockers: [],
    canAutoInstall: false,
    updatedAt: "",
});

export const updaterStore = defineStore("updater", {
    state() {
        return {
            visible: false,
            checking: false,
            probing: false,
            installing: false,
            state: emptyState(),
            probes: [] as ProbeResult[],
            selectedUrl: "",
            probeKey: "",
            error: "",
        };
    },
    getters: {
        updateAvailable(): boolean {
            return ["available", "downloading", "ready"].includes(
                this.state.phase,
            );
        },
        latestVersion(): string {
            return (
                this.state.latestVersion || this.state.release?.version || ""
            );
        },
        isDownloading(): boolean {
            return this.state.phase === "downloading";
        },
        isReady(): boolean {
            return this.state.phase === "ready";
        },
        progressPercent(): number {
            return Math.max(
                0,
                Math.min(100, Math.round(this.state.progress || 0)),
            );
        },
        sizeText(): string {
            return formatBytes(this.state.total || 0);
        },
        downloadedText(): string {
            return formatBytes(this.state.downloaded || 0);
        },
        speedText(): string {
            return formatSpeed(this.state.speed || 0);
        },
        fastestProbe(): ProbeResult | null {
            return this.probes.find((item) => item.ok) || null;
        },
        hasBlockers(): boolean {
            return (this.state.blockers || []).length > 0;
        },
        hasStoppableBlockers(): boolean {
            return (this.state.blockers || []).some(
                (item) => item.type !== "app",
            );
        },
        canAutoInstall(): boolean {
            return !!this.state.canAutoInstall;
        },
        notes(): string {
            return (
                this.state.release?.notes || this.state.release?.summary || ""
            );
        },
        feature(): string {
            return this.state.release?.feature || "";
        },
    },
    actions: {
        init() {
            window.$mapi.updater.onState((state: UpdaterState) => {
                this.state = { ...emptyState(), ...state };
                if (state.phase === "available") {
                    this.maybeProbe();
                }
                if (state.phase === "failed") {
                    this.error = state.error || "";
                }
            });
            window.$mapi.updater
                .getState()
                .then((state: UpdaterState) => {
                    this.state = { ...emptyState(), ...state };
                })
                .catch(() => {});
        },
        show() {
            this.visible = true;
            this.error = "";
        },
        hide() {
            this.visible = false;
        },
        async check(noticeLatest = true) {
            this.checking = true;
            this.error = "";
            // 手动检测时立即打开面板；启动自动检测只有发现新版本才打开
            this.visible = noticeLatest;
            try {
                const state: UpdaterState =
                    await window.$mapi.updater.checkForUpdate();
                this.state = { ...emptyState(), ...state };
                if (state.phase === "up-to-date") {
                    if (noticeLatest) {
                        window.$mapi.app.toast(t("update.alreadyLatest"), {
                            status: "success",
                        });
                    }
                } else if (state.phase === "available") {
                    this.visible = true;
                    await this.maybeProbe(true);
                } else if (state.phase === "failed") {
                    this.error = state.error || t("update.checkFailed");
                }
            } catch (e: any) {
                this.error = e?.message || t("update.checkFailed");
                if (noticeLatest) {
                    window.$mapi.app.toast(this.error, { status: "error" });
                }
            } finally {
                this.checking = false;
            }
        },
        async maybeProbe(force = false) {
            const channels = this.state.channels || [];
            if (channels.length === 0) {
                return;
            }
            const key = channels.map((item) => item.url).join("|");
            if (!force && key === this.probeKey && this.probes.length) {
                return;
            }
            this.probeKey = key;
            this.probing = true;
            try {
                const raw = await window.$mapi.updater.probe(channels);
                const withRank = raw.map((item, index) => ({
                    ...item,
                    rank: index,
                }));
                this.probes = sortProbeResults(withRank);
                const fastest = this.probes.find((item) => item.ok);
                this.selectedUrl = fastest ? fastest.url : "";
            } catch (e) {
                this.probes = channels.map((item, index) => ({
                    title: item.title,
                    url: item.url,
                    ok: false,
                    latency: Number.MAX_SAFE_INTEGER - index,
                    rank: index,
                }));
                this.selectedUrl = "";
            } finally {
                this.probing = false;
            }
        },
        selectChannel(url: string) {
            this.selectedUrl = url;
        },
        async download() {
            this.error = "";
            if (!this.state.asset) {
                this.error = t("update.noAsset");
                return;
            }
            try {
                await window.$mapi.updater.download({
                    url: this.selectedUrl || undefined,
                });
            } catch (e: any) {
                this.error = e?.message || t("update.downloadFailed");
            }
        },
        async cancelDownload() {
            try {
                await window.$mapi.updater.cancelDownload();
            } catch (e) {}
        },
        async preflight() {
            try {
                const blockers = await window.$mapi.updater.preflight();
                this.state.blockers = blockers || [];
                return this.state.blockers;
            } catch (e) {
                this.state.blockers = [];
                return [];
            }
        },
        async stopBlockers() {
            try {
                const blockers = await window.$mapi.updater.stopBlockers();
                this.state.blockers = blockers || [];
                return this.state.blockers;
            } catch (e) {
                return this.state.blockers;
            }
        },
        async restart() {
            if (this.installing) {
                return;
            }
            this.error = "";
            const blockers = await this.preflight();
            if (blockers.length > 0) {
                return;
            }
            this.installing = true;
            try {
                const res = await window.$mapi.updater.install();
                if (res?.state) {
                    this.state = { ...emptyState(), ...res.state };
                }
                if (!res?.ok) {
                    this.error = res?.error || t("update.installFailed");
                }
            } catch (e: any) {
                this.error = e?.message || t("update.installFailed");
            } finally {
                this.installing = false;
            }
        },
        async stopBlockersAndRestart() {
            const blockers = await this.stopBlockers();
            if (blockers.length > 0) {
                return;
            }
            await this.restart();
        },
        async openDownloadedFile() {
            await window.$mapi.updater.openDownloadedFile();
        },
        async openDownloadPage() {
            await window.$mapi.updater.openDownloadPage();
        },
    },
});
