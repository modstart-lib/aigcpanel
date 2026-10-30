<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Message } from "@arco-design/web-vue";
import { Dialog } from "../lib/dialog";
import { OfflineAuth } from "../lib/offlineAuth";
import { t } from "../lang";

const token = ref("");
const softwareName = ref("");
const saving = ref(false);
const request = computed(() => OfflineAuth.state.request || {});

/** 解析授权码 payload（仅用于本地提前校验，最终以启动器验签为准） */
const tokenPayload = computed(() => {
    const value = token.value.trim();
    const dot = value.indexOf(".");
    if (dot <= 0) return null;
    try {
        const binary = atob(value.slice(0, dot));
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        return null;
    }
});

/** 授权码绑定的软件与输入的软件名称不一致 */
const nameMismatch = computed(() => {
    const payload = tokenPayload.value;
    if (!payload?.packageName || !softwareName.value.trim()) return false;
    return payload.packageName !== softwareName.value.trim();
});

/** 授权码与本机机器码不一致 */
const machineMismatch = computed(() => {
    const payload = tokenPayload.value;
    if (!payload?.machineId || !request.value.machineId) return false;
    return payload.machineId !== request.value.machineId;
});

const formatTime = (timestamp: number) => {
    if (!timestamp) return t("offlineAuth.permanent");
    const d = new Date(timestamp * 1000);
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
        d.getHours(),
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** 授权到期时间文案（0 表示永久） */
const expireText = computed(() => {
    const payload = tokenPayload.value;
    if (!payload) return "";
    return formatTime(Number(payload.expireAt || 0));
});

/** 签发时间文案 */
const issuedText = computed(() => {
    const payload = tokenPayload.value;
    if (!payload) return "";
    return payload.issuedAt ? formatTime(Number(payload.issuedAt)) : "-";
});

const expired = computed(() => {
    const payload = tokenPayload.value;
    if (!payload) return false;
    const expireAt = Number(payload.expireAt || 0);
    return expireAt > 0 && Date.now() / 1000 > expireAt;
});

const versionMismatch = computed(() => {
    const payload = tokenPayload.value;
    return !!payload && Number(payload.v || 0) !== 1;
});

/** 授权状态（版本 > 过期 > 包名 > 设备码 > 有效） */
const statusText = computed(() => {
    if (!tokenPayload.value) return "";
    if (versionMismatch.value) return t("offlineAuth.statusVersion");
    if (expired.value) return t("offlineAuth.statusExpired");
    if (nameMismatch.value) return t("offlineAuth.statusNameMismatch");
    if (machineMismatch.value) return t("offlineAuth.statusMachineMismatch");
    return t("offlineAuth.statusValid");
});

const statusValid = computed(
    () => !!tokenPayload.value && statusText.value === t("offlineAuth.statusValid"),
);

const isEdit = computed(() => !!request.value.token);

const visible = computed({
    get: () => OfflineAuth.state.visible,
    set: (value: boolean) => {
        if (!value) {
            OfflineAuth.resolve(null);
        }
    },
});

watch(
    () => OfflineAuth.state.visible,
    (value) => {
        if (value) {
            // 编辑已有授权时预填原授权码
            token.value = request.value.token || "";
            softwareName.value = request.value.packageName || "";
        }
    },
);

const doCopyMachineId = async () => {
    if (!request.value.machineId) {
        return;
    }
    await window.$mapi.app.setClipboardText(request.value.machineId);
    Message.success(t("common.copySuccess"));
};

const doRevoke = async () => {
    await Dialog.confirm(
        t("offlineAuth.revokeConfirm"),
        t("offlineAuth.revoke"),
    );
    try {
        const onRevoke = request.value.onRevoke;
        if (!onRevoke) {
            return;
        }
        const res: any = await onRevoke();
        if (res && res.code) {
            Dialog.tipError(res.msg || t("offlineAuth.revokeFailed"));
            return;
        }
        Message.success(t("offlineAuth.revoked"));
        request.value.onRevoked?.();
        OfflineAuth.resolve(null);
    } catch (e) {
        Dialog.tipError(String(e));
    }
};

const doOk = () => {
    const name = softwareName.value.trim();
    if (!name) {
        Message.warning(t("offlineAuth.nameRequired"));
        return;
    }
    const value = token.value.trim();
    if (!value) {
        Message.warning(t("offlineAuth.required"));
        return;
    }
    if (nameMismatch.value) {
        Message.warning(t("offlineAuth.nameMismatch"));
        return;
    }
    if (machineMismatch.value) {
        Message.warning(t("offlineAuth.machineMismatch"));
        return;
    }
    const onSave = request.value.onSave;
    if (onSave) {
        // 由调用方调用 launcher 真实校验，失败时保持弹窗并提示具体原因
        saving.value = true;
        onSave(value)
            .then((res) => {
                saving.value = false;
                if (res && res.code) {
                    Message.error(res.msg || t("offlineAuth.saveFailed"));
                    return;
                }
                OfflineAuth.resolve(value);
            })
            .catch((e) => {
                saving.value = false;
                Message.error(String(e));
            });
        return;
    }
    OfflineAuth.resolve(value);
};
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="26rem"
        modal-class="pb-offline-auth"
        title-align="start"
        :title="t(isEdit ? 'offlineAuth.editTitle' : 'offlineAuth.title')"
        :mask-closable="false"
    >
        <div class="text-sm text-gray-500">
            {{ t(isEdit ? "offlineAuth.editDesc" : "offlineAuth.desc") }}
        </div>
        <div class="mt-4">
            <div class="text-xs text-gray-400">
                {{ t("offlineAuth.name") }}
            </div>
            <a-input
                v-model="softwareName"
                class="mt-1"
                :placeholder="t('offlineAuth.namePlaceholder')"
            />
            <div v-if="nameMismatch" class="text-xs text-red-500 mt-1">
                {{ t("offlineAuth.nameMismatch") }}
            </div>
        </div>
        <div class="mt-4">
            <div class="text-xs text-gray-400">
                {{ t("offlineAuth.machineId") }}
            </div>
            <div class="flex items-center gap-2 mt-1">
                <a-input
                    :model-value="request.machineId || tokenPayload?.machineId || '-'"
                    readonly
                />
                <a-button @click="doCopyMachineId">
                    {{ t("offlineAuth.copy") }}
                </a-button>
            </div>
            <div class="text-xs text-gray-400 mt-1">
                {{ t("offlineAuth.machineIdTips") }}
            </div>
        </div>
        <div class="mt-4">
            <div class="text-xs text-gray-400">
                {{ t("offlineAuth.license") }}
            </div>
            <a-textarea
                v-model="token"
                class="mt-1"
                :auto-size="{ minRows: 3, maxRows: 6 }"
                :placeholder="t('offlineAuth.placeholder')"
            />
            <div v-if="machineMismatch" class="text-xs text-red-500 mt-1">
                {{ t("offlineAuth.machineMismatch") }}
            </div>
            <!-- 授权信息：粘贴/已有授权码后展示到期时间与状态 -->
            <div
                v-if="tokenPayload"
                class="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-6 text-gray-600"
            >
                <div class="flex items-center justify-between">
                    <span class="text-gray-400">{{ t("offlineAuth.info") }}</span>
                    <span
                        :class="
                            statusValid ? 'text-green-600' : 'text-red-500'
                        "
                    >
                        {{ statusText }}
                    </span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-gray-400">
                        {{ t("offlineAuth.expireAt") }}
                    </span>
                    <span :class="expired ? 'text-red-500' : ''">
                        {{ expireText }}
                    </span>
                </div>
                <div class="flex items-center justify-between">
                    <span class="text-gray-400">
                        {{ t("offlineAuth.issuedAt") }}
                    </span>
                    <span>{{ issuedText }}</span>
                </div>
            </div>
        </div>
        <template #footer>
            <a-button
                v-if="isEdit"
                class="mr-auto"
                status="danger"
                type="text"
                @click="doRevoke"
            >
                {{ t("offlineAuth.revoke") }}
            </a-button>
            <a-button @click="visible = false">
                {{ t("common.cancel") }}
            </a-button>
            <a-button type="primary" :loading="saving" @click="doOk">
                {{ t("common.confirm") }}
            </a-button>
        </template>
    </a-modal>
</template>

<style lang="less">
.pb-offline-auth {
    .arco-modal-header {
        border-bottom: none;
    }

    .arco-modal-footer {
        border-top: none;
    }
}
</style>
