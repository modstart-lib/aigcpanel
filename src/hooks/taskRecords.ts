import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { groupThrottle } from "../lib/groupThrottle";
import { TaskBiz, TaskRecord, TaskService } from "../service/TaskService";
import { useTaskStore } from "../store/modules/task";

export type UseTaskRecordsOption = {
    pageSize?: number;
    // Filter pushed into SQL instead of slicing the loaded rows
    serverName?: () => string;
    // Extra filter for pickers that only show one status (e.g. successful sounds)
    statusList?: Exclude<TaskRecord["status"], "pause">[];
    // Lists that used to wait before re-reading keep the same delay
    patchDelay?: number;
    // Per-row decoration kept from the previous list implementation
    decorate?: (record: TaskRecord) => void;
};

// Task list backed by SQL paging: only the current page is loaded, and progress
// events patch the single changed row instead of re-reading the whole table.
export const useTaskRecords = (
    biz: TaskBiz,
    option: UseTaskRecordsOption = {},
) => {
    const taskStore = useTaskStore();
    const pageSize =
        option.pageSize && option.pageSize > 0 ? option.pageSize : 10;
    const page = ref(1);
    const records = ref<TaskRecord[]>([]);
    const total = ref(0);
    // Records already hold the current page only: no extra slicing
    const recordsForPage = computed(() => records.value);

    let reloading = false;
    let reloadPending = false;

    const decorate = (record: TaskRecord) => {
        option.decorate?.(record);
        return record;
    };

    const query = () => ({
        page: page.value,
        pageSize,
        serverName: option.serverName?.() || "",
        statusList: option.statusList,
    });

    const reload = async () => {
        if (reloading) {
            // Keep the last request instead of dropping it: it may be a page
            // change or a filter change that happened during the query.
            reloadPending = true;
            return;
        }
        reloading = true;
        try {
            const q = query();
            const [rows, count] = await Promise.all([
                TaskService.listPage(biz, q),
                TaskService.countPage(biz, q),
            ]);
            if (page.value > 1 && count > 0 && rows.length === 0) {
                // The last row of the last page was deleted: the page watcher
                // reloads the previous page.
                page.value -= 1;
                records.value = [];
                total.value = count;
                return;
            }
            records.value = rows.map(decorate);
            total.value = count;
        } finally {
            reloading = false;
            if (reloadPending) {
                reloadPending = false;
                await reload();
            }
        }
    };

    const removeRecord = (index: number) => {
        records.value.splice(index, 1);
        total.value = Math.max(0, total.value - 1);
    };

    const patch = async (bizId: string) => {
        // HTTP and CLI dispatches use String(id) while DB rows carry a number
        const id = String(bizId);
        const record = await TaskService.get(id);
        const index = records.value.findIndex((r) => String(r.id) === id);
        if (!record) {
            if (index >= 0) {
                removeRecord(index);
            }
            return;
        }
        const serverName = option.serverName?.() || "";
        const matchesFilter =
            (!serverName || record.serverName === serverName) &&
            (!option.statusList ||
                (!!record.status &&
                    (option.statusList as string[]).includes(record.status)));
        if (!matchesFilter) {
            if (index >= 0) {
                removeRecord(index);
            }
            return;
        }
        if (index >= 0) {
            const next = decorate(record);
            (next as any)._check = (records.value[index] as any)._check;
            records.value[index] = next;
            return;
        }
        // The row is not on this page. A brand new task is the only case that
        // must be shown now; anything else is picked up when its page is loaded.
        if (page.value !== 1) {
            return;
        }
        const maxId = records.value.reduce(
            (max, r) => Math.max(max, Number(r.id) || 0),
            0,
        );
        if ((Number(record.id) || 0) > maxId) {
            await reload();
        }
    };

    const patchThrottled = groupThrottle(
        async (id: string) => {
            await patch(id);
        },
        Math.max(0, option.patchDelay || 0),
        { trailing: true },
    );

    const onChange = (bizId: string) => {
        if (option.patchDelay && option.patchDelay > 0) {
            patchThrottled(String(bizId));
        } else {
            patch(String(bizId)).catch(() => {});
        }
    };

    onMounted(() => {
        taskStore.onChange(biz, onChange);
        reload().catch(() => {});
    });
    onBeforeUnmount(() => {
        taskStore.offChange(biz, onChange);
    });
    watch(page, () => {
        reload().catch(() => {});
    });

    return {
        page,
        pageSize,
        records,
        recordsForPage,
        total,
        reload,
    };
};
