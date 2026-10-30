<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useServerStore } from "../../store/modules/server";
import { EnumServerType, ServerRecord } from "../../types/Server";
import { t } from "../../lang";

const props = defineProps<{
    record: ServerRecord;
}>();

const serverStore = useServerStore();
const token = ref("");

const decode = (value: string) => {
    const dot = value.indexOf(".");
    if (dot <= 0) {
        return null;
    }
    try {
        const binary = atob(value.slice(0, dot));
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        return null;
    }
};

const payload = computed(() => decode(token.value));
const expireAt = computed(() => Number(payload.value?.expireAt || 0));
const expired = computed(
    () => expireAt.value > 0 && Date.now() / 1000 > expireAt.value,
);
const expireText = computed(() => {
    if (!payload.value) {
        return "";
    }
    if (!expireAt.value) {
        return t("model.offlineAuthPermanent");
    }
    const d = new Date(expireAt.value * 1000);
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
});

const label = computed(() => {
    if (!payload.value) {
        return "";
    }
    if (expired.value) {
        return t("model.offlineAuthExpired");
    }
    if (!expireAt.value) {
        return t("model.offlineAuthPermanentLabel");
    }
    return t("model.offlineAuthExpire", { date: expireText.value });
});

const visible = computed(
    () =>
        !!props.record.localPath &&
        props.record.type !== EnumServerType.CLOUD &&
        props.record.type !== EnumServerType.API,
);

const load = async () => {
    if (!visible.value) {
        return;
    }
    try {
        const info = await serverStore.serverInfo(props.record);
        const res: any = await $mapi.server.offlineAuthToken(info);
        token.value = (res && res.data && res.data.token) || "";
    } catch (e) {
        token.value = "";
    }
};

onMounted(load);
watch(
    () => serverStore.offlineAuthVersion,
    () => {
        load().then();
    },
);
watch(
    () => props.record.key,
    () => {
        load().then();
    },
);
</script>

<template>
    <a-tooltip
        v-if="visible && payload"
        :content="label"
        mini
    >
        <span
            class="ml-2 inline-block rounded-3xl px-3 text-xs"
            :class="
                expired
                    ? 'bg-red-50 text-red-500'
                    : 'bg-green-50 text-green-600'
            "
        >
            {{ label }}
        </span>
    </a-tooltip>
</template>
