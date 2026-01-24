import { t } from "../../../lang";
import { TaskRecord, TaskService } from "../../../service/TaskService";
import { TaskChangeType, useTaskStore } from "../../../store/modules/task";
import { TaskRunResult } from "./type";

const taskStore = useTaskStore();

export const createTaskRunResult = async (
    taskId: string,
    successCallback: (data: Record<string, any>, task: TaskRecord) => void
) => {
    const task = await TaskService.get(taskId);
    if (!task) {
        throw t("error.taskNotFound");
    }
    const biz = task.biz;
    return () => {
        return new Promise<TaskRunResult>(resolve => {
            const callback = (bizId: string, type: TaskChangeType) => {
                if (bizId !== taskId) {
                    return;
                }
                TaskService.get(bizId).then(task => {
                    if (!task) {
                        resolve({code: -1, msg: t("error.taskNotFound")});
                        taskStore.offChange(biz, callback);
                        return;
                    }
                    if (task.status === 'success') {
                        const data = {status: 'success'};
                        successCallback(data, task);
                        resolve({
                            code: 0,
                            msg: 'ok',
                            data: data,
                        } as TaskRunResult);
                        taskStore.offChange(biz, callback);
                        return;
                    }
                    if (task.status === 'pause') {
                        resolve({
                            code: 0,
                            msg: '',
                            data: {status: 'pause'}
                        });
                        taskStore.offChange(biz, callback);
                        return;
                    }
                    if (task.status === 'fail') {
                        resolve({code: -1, msg: task.statusMsg || t("error.taskFailed")});
                        taskStore.offChange(biz, callback);
                        return;
                    }
                }).catch(error => {
                    resolve({code: -1, msg: '' + error || t("error.getTaskFailed")});
                    taskStore.offChange(biz, callback);
                })
            }
            taskStore.onChange(biz, callback);
            callback(taskId, null!);
        })
    }
}
