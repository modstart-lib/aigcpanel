<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { TaskService } from "../service/TaskService";
import { WorkflowLogService } from "../service/WorkflowService";
import { useSettingStore } from "../store/modules/setting";

const visible = ref(false);
const remember = ref(false);
const setting = useSettingStore();
const exitMode = setting.configGet("exitMode", "");
const counts = ref({
    running: 0,
    queued: 0,
    cloud: 0,
});
const total = computed(() => counts.value.running + counts.value.queued);
// 有未完成任务时不允许在应用内退出（产品决定：先停止任务），
// 统计口径与主进程 before-quit 共用，见 src/lib/quitGuard.ts
const blocked = computed(() => total.value > 0);
let refreshTimer: any = null;

const refreshCounts = async () => {
    try {
        const [tasks, workflowCount] = await Promise.all([
            TaskService.countUnfinished(),
            WorkflowLogService.countRunning(),
        ]);
        counts.value = {
            running: tasks.running + workflowCount,
            queued: tasks.queued,
            cloud: tasks.cloud,
        };
    } catch (e) {
        // 数据库尚未就绪等情况不做拦截，避免把用户锁在窗口里
        counts.value = { running: 0, queued: 0, cloud: 0 };
    }
};

const stopRefreshTimer = () => {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
};

const startRefreshTimer = () => {
    stopRefreshTimer();
    // 弹窗打开期间任务完成时，让「退出」及时恢复可点
    refreshTimer = setInterval(() => {
        if (visible.value) {
            refreshCounts();
        }
    }, 3000);
};

watch(visible, (value) => {
    if (!value) {
        stopRefreshTimer();
    }
});

const show = async (option?: { force?: boolean }) => {
    await refreshCounts();
    if (!option?.force) {
        if (exitMode.value === "hide") {
            await doHide();
            return;
        }
        if (exitMode.value === "exit" && !blocked.value) {
            await doExit();
            return;
        }
    }
    // 有未完成任务时，即使记住过「退出」也要弹窗，不能静默退出
    visible.value = true;
    startRefreshTimer();
};

const doCancel = () => {
    visible.value = false;
};

const doHide = async () => {
    if (remember.value) {
        await setting.setConfig("exitMode", "hide");
    }
    visible.value = false;
    setTimeout(async () => {
        await window.$mapi.app.windowHide();
    }, 100);
};

const doExit = async () => {
    if (blocked.value) {
        return;
    }
    if (remember.value) {
        await setting.setConfig("exitMode", "exit");
    }
    visible.value = false;
    await window.$mapi.app.quit();
};

onBeforeUnmount(() => {
    stopRefreshTimer();
});

defineExpose({
    show,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="22rem"
        modal-class="pb-app-quit-confirm"
        :closable="true"
        :title="$t('common.tip')"
        title-align="start"
    >
        <template #footer>
            <a-button @click="doCancel">{{ $t("common.cancel") }}</a-button>
            <a-button :disabled="blocked" @click="doExit">{{
                $t("common.exit")
            }}</a-button>
            <a-button type="primary" @click="doHide">{{
                $t("common.hideWindow")
            }}</a-button>
        </template>
        <div>
            <div class="text-center">{{ $t("common.exitConfirm") }}</div>
            <div
                v-if="blocked"
                class="mt-3 text-sm leading-5 text-amber-600 dark:text-amber-400"
            >
                {{
                    $t(
                        counts.running > 0
                            ? "app.exitTasksUnfinished"
                            : "app.exitTasksQueuedOnly",
                        {
                            count: total,
                            running: counts.running,
                            queued: counts.queued,
                        },
                    )
                }}
            </div>
            <div
                v-if="counts.cloud > 0"
                class="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400"
            >
                {{ $t("app.exitTasksCloudHint", { count: counts.cloud }) }}
            </div>
            <div class="text-center mt-4">
                <a-checkbox v-model="remember">
                    <span class="text-sm text-gray-500">{{
                        $t("common.rememberChoice")
                    }}</span>
                </a-checkbox>
            </div>
        </div>
    </a-modal>
</template>

<style lang="less">
.pb-app-quit-confirm {
    .arco-modal-header {
        border-bottom: none;
    }

    .arco-modal-footer {
        border-top: none;
    }
}
</style>
