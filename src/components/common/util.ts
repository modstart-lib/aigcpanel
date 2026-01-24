import {onMounted, toRaw, watch} from "vue";
import {AppConfig} from "../../config";
import {t} from "../../lang";
import {defaultResponseProcessor} from "../../lib/api";
import {Dialog} from "../../lib/dialog";
import {StorageUtil} from "../../lib/storage";
import {VersionUtil} from "../../lib/util";

export const doCopy = async (text: string | object, successTip: string = ""): Promise<void> => {
    successTip = successTip || t("common.copySuccess");
    text = typeof text === "object" ? JSON.stringify(text) : String(text);
    await window.$mapi.app.setClipboardText(text);
    Dialog.tipSuccess(successTip);
};

export const doSaveFile = async (filePath: string) => {
    try {
        const options: any = {
            defaultPath: window.$mapi.file.pathToName(filePath, true, -1),
        };
        const savePath = await window.$mapi.file.openSave(options);
        if (savePath) {
            await window.$mapi.file.copy(filePath, savePath, {
                isDataPath: false
            });
            Dialog.tipSuccess(t("msg.fileSavedTo", {path: savePath}));
        }
    } catch (error) {
        Dialog.tipError(t("error.saveFileFailed", {error: (error as Error).message || error}));
    }
};

export const doOpenFile = async (
    options?: {
        extensions?: string[],
        multiple?: boolean,
    }
): Promise<string | string[] | undefined> => {
    options = Object.assign({
        extensions: [],
        multiple: false,
    }, options);
    try {
        const opt: any = {};
        if (options.extensions && options.extensions.length > 0) {
            opt.filters = [{
                name: t("hint.fileTypes"),
                extensions: toRaw(options.extensions),
            }]
        }
        if (options.multiple) {
            opt.properties = ['multiSelections'];
        }
        const result = await window.$mapi.file.openFile(opt);
        if (result) {
            return result
        }
    } catch (error) {
        Dialog.tipError(t("error.selectFileFailed", {error}));
    }
}

export const doOpenBrowserFile = (options: {
    accept: string
    multiple: boolean
    max?: string
}): Promise<File | null> => {
    options = Object.assign({
        accept: '*/*',
        multiple: false,
        max: undefined
    });
    const compareSize = (size: number, target: string): boolean => {
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = sizes.findIndex(item => item === target.replace(/\d+/, ''));
        return size > parseInt(target) * k ** i;
    };
    return new Promise((resolve, reject) => {
        // 创建input[file]元素
        const input = document.createElement('input');
        // 设置相应属性
        input.setAttribute('type', 'file');
        input.setAttribute('accept', options.accept);
        if (options.multiple) {
            input.setAttribute('multiple', 'multiple');
        } else {
            input.removeAttribute('multiple');
        }
        // 绑定事件
        input.onchange = function () {
            // @ts-ignore
            let files: File[] = Array.from(this.files);
            if (files) {
                const length = files.length;
                files = files.filter(file => {
                    if (options.max) {
                        return !compareSize(file.size, options.max);
                    } else {
                        return true;
                    }
                });
                if (files && files.length > 0) {
                    if (length !== files.length) {
                        // message.warning(`已过滤上传文件中大小大于${options.max}的文件`);
                    }
                    resolve(files[0]);
                } else {
                    Dialog.tipError(`上传文件大小不能大于${options.max}`);
                    resolve(null);
                }
            } else {
                reject(null);
            }
        };
        input.oncancel = function () {
            reject(null);
        };
        input.click();
    });
};


export const doCheckForUpdate = async (noticeLatest?: boolean) => {
    const res = await window.$mapi.updater.checkForUpdate();
    defaultResponseProcessor(res, (res: ApiResult<any>) => {
        if (!res.data.version) {
            Dialog.tipError(t("update.checkFailed"));
            return;
        }
        if (VersionUtil.le(res.data.version, AppConfig.version)) {
            if (noticeLatest) {
                Dialog.tipSuccess(t("update.alreadyLatest"));
            }
            return;
        }
        Dialog.confirm(t("update.newVersionFound", {version: res.data.version})).then(() => {
            window.$mapi.app.openExternal(AppConfig.downloadUrl);
        });
    });
};

export const dataAutoSaveDraft = (
    key: string,
    data: any,
    option?: {
        type: 'object' | 'array',
        confirmText?: string | null,
    }
) => {
    option = Object.assign({
        type: 'object',
        confirmText: null,
    }, option);
    const load = async () => {
        const value = await result()
        if ('object' === option?.type) {
            if (value) {
                if (option.confirmText) {
                    await Dialog.confirm(option.confirmText)
                }
                for (const k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        data[k] = value[k];
                    }
                }
            }
        } else if ('array' === option?.type) {
            if (Array.isArray(value) && value.length > 0) {
                if (option.confirmText) {
                    await Dialog.confirm(option.confirmText)
                }
                data.splice(0, data.length, ...value);
            }
        }
    }
    onMounted(async () => [
        await load()
    ]);
    watch(
        () => data,
        async value => {
            // console.log('data changed, save draft to local storage', key, value);
            StorageUtil.set(key, value);
        },
        {
            deep: true,
        }
    );
    const clearDraft = () => {
        StorageUtil.remove(key);
    };
    const result = async () => {
        if ('object' === option?.type) {
            return StorageUtil.getObject(key);
        } else if ('array' === option?.type) {
            return StorageUtil.getArray(key);
        }
        throw new Error('dataAutoSaveDraft: unknown type' + option?.type);
    }
    return {
        clearDraft,
        load,
    };
};
