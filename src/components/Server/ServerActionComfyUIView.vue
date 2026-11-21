<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useServerStore } from "../../store/modules/server";
import { useUserStore } from "../../store/modules/user";
import { EnumServerStatus, ServerRecord } from "../../types/Server";
import { Dialog } from "../../lib/dialog";
import { t } from "../../lang";
import { mapError } from "../../lib/error";



const serverStore = useServerStore();
const userStore = useUserStore();

const props = defineProps<{
    record: ServerRecord;
}>();

const isComfyUI = () => {
    return (props.record as any)?.config?.type === "comfyui";
};

// 服务是否在运行：未启动时不显示流程管理入口（避免点击出现 no httpUrl）
// - 自启动模型：runtime.status 初始恒 RUNNING 不可靠，用 HTTP ping 探测真实进程状态
// - 手动启动模型：状态由启停事件驱动（record.status）
const servicePinged = ref(false);
const isServiceRunning = computed(() => {
    if (props.record.autoStart) {
        return servicePinged.value;
    }
    return props.record.status === EnumServerStatus.RUNNING;
});

const checkService = async () => {
    try {
        const serverInfo = await serverStore.serverInfo(props.record);
        servicePinged.value = await $mapi.server.ping(serverInfo);
    } catch (e) {
        servicePinged.value = false;
    }
};

// 服务状态变化（任务自动拉起 / 空闲退出 / 手动启停）时重新探测
watch(
    () => [props.record.runtime?.status, props.record.runtime?.autoStartStatus],
    () => {
        checkService().then();
    },
);

// ---------- 流程管理弹窗 ----------
const visible = ref(false);
const loading = ref(false);
const httpUrl = ref("");
const workflows = ref<any[]>([]);


// 流程管理按钮是否显示：PRO 构建（enableWorkflowManager）且 VIP 用户。
// 非 PRO 构建时 #if 移除上方逻辑，恒为 false（按钮不渲染，且不会因模板引用未定义变量报错）
const showWorkflowManager = computed(() => {
    
    return false;
});



onMounted(async () => {
    if (!isComfyUI()) {
        return;
    }
    try {
        
        await userStore.waitInit();
    } catch (e) {
        /* 忽略 */
    }
    
    await checkService();
});

type WorkflowRow = {
    key: string;
    title: string;
    description: string;
    hasUserConfig: boolean;
    biz?: string;
};

const loadWorkflows = async () => {
    loading.value = true;
    try {
        const serverInfo = await serverStore.serverInfo(props.record);
        const configRes = await $mapi.server.config(serverInfo);
        httpUrl.value = configRes?.data?.httpUrl || "";
        
        workflows.value = configRes?.data?.workflows || [];
    } catch (e) {
        Dialog.tipError(mapError(e));
    } finally {
        loading.value = false;
    }
};

const openManager = async () => {
    visible.value = true;
    await loadWorkflows();
};

const doOpen = async (row: WorkflowRow) => {
    // httpUrl 为空时重新拉取配置（服务可能刚自动拉起，端口稍后就绪）
    if (!httpUrl.value) {
        await loadWorkflows();
    }
    if (!httpUrl.value) {
        Dialog.tipError(t("model.comfyuiView") + ": no httpUrl");
        return;
    }
    await $mapi.app.windowOpen("comfyui-view", {
        url: httpUrl.value,
        title: `${props.record.title} - ComfyUI`,
        comfyuiNames: [row.key],
    });
    // 注意：不在这里标记"已修改"——只有用户在 ComfyUI 中实际修改并保存
    // （生成 workflow.user.json）后，重新打开流程管理时才会显示"已修改"
};

const doRestore = async (row: WorkflowRow) => {
    if (!row.hasUserConfig) {
        return;
    }
    // 二次确认：恢复默认将删除用户修改，回到出厂配置
    await Dialog.confirm(t("app.workflowRestoreConfirm"));
    const serverInfo = await serverStore.serverInfo(props.record);
    const res = await serverStore.call(serverInfo, "restoreWorkflow", {
        comfyuiName: row.key,
    });
    if (res.code) {
        Dialog.tipError(mapError(res.msg));
        return;
    }
    Dialog.tipSuccess(t("app.workflowRestored"));
    // 重置本地编辑标记，并刷新列表同步真实状态（有 workflow.user.json 才保持已编辑）
    row.hasUserConfig = false;
    await loadWorkflows();
};

const columns = computed(() => [
    {
        title: t("app.workflowTitle"),
        dataIndex: "title",
        slotName: "title",
    },
    {
        title: t("app.workflowAction"),
        slotName: "action",
        width: 220,
    },
]);
</script>

<template>
    <a-tooltip
        v-if="isComfyUI() && showWorkflowManager && isServiceRunning"
        :content="$t('model.comfyuiView') || '查看'"
        mini
    >
        <a-button
            class="mr-2"
            type="primary"
            status="normal"
            :disabled="record.status !== EnumServerStatus.RUNNING"
            @click="openManager()"
        >
            <template #icon>
                <icon-eye />
            </template>
        </a-button>
    </a-tooltip>

    <a-modal
        v-model:visible="visible"
        :title="$t('app.comfyuiWorkflowManager')"
        :width="760"
        :footer="false"
        :loading="loading"
        title-align="start"
        @open="loadWorkflows"
    >
        <div>
            <a-table
                :data="workflows"
                :columns="columns"
                :loading="loading"
                :pagination="false"
                row-key="key"
                size="small"
            >
                <template #title="{ record }">
                    <div class="flex items-center gap-2">
                        <span class="font-medium">{{ record.title }}</span>
                        <a-tag
                            v-if="record.hasUserConfig"
                            color="orange"
                            size="mini"
                        >
                            {{ $t("app.workflowModified") }}
                        </a-tag>
                        <span class="text-xs text-gray-400 font-normal">
                            {{ record.key }}
                        </span>
                    </div>
                    <div
                        v-if="record.description"
                        class="text-xs text-gray-400"
                    >
                        {{ record.description }}
                    </div>
                </template>
                <template #action="{ record }">
                    <a-button
                        type="primary"
                        size="mini"
                        class="mr-2"
                        @click="doOpen(record)"
                    >
                        {{ $t("app.workflowEdit") }}
                    </a-button>
                    <a-button
                        size="mini"
                        :disabled="!record.hasUserConfig"
                        @click="doRestore(record)"
                    >
                        {{ $t("app.workflowRestore") }}
                    </a-button>
                </template>
            </a-table>
        </div>
    </a-modal>
</template>
