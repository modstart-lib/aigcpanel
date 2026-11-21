import { t } from "../config/lang";

/**
 * Recursively walk an object/array and map every string value through `handler`.
 * `handler` returns the replacement string, or null/undefined to keep the
 * original value untouched. Returns a new value (does not mutate the input).
 *
 * Used to upload local file paths nested inside modelConfig / param before
 * calling a remote or cloud model server (which cannot access local files).
 */
export const replaceDeepStrings = async (
    value: any,
    handler: (text: string) => Promise<string | null | undefined>,
): Promise<any> => {
    if (typeof value === "string") {
        const replaced = await handler(value);
        return replaced === null || typeof replaced === "undefined"
            ? value
            : replaced;
    }
    if (Array.isArray(value)) {
        const result: any[] = [];
        for (const item of value) {
            result.push(await replaceDeepStrings(item, handler));
        }
        return result;
    }
    if (value && typeof value === "object") {
        const result: Record<string, any> = {};
        for (const key of Object.keys(value)) {
            result[key] = await replaceDeepStrings(value[key], handler);
        }
        return result;
    }
    return value;
};

export const AigcServerUtil = {
    errorDetect: (data: string): string | null => {
        const runtimeVramOverflow = t("error.runtimeVramOverflow");
        // Match the various ways PyTorch reports CUDA VRAM exhaustion:
        // - torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate ...
        // - torch.AcceleratorError: CUDA error: out of memory
        // Keep the keyword list narrow enough to avoid false positives.
        const errorMap = {
            "torch.cuda.OutOfMemoryError": runtimeVramOverflow,
            "CUDA error: out of memory": runtimeVramOverflow,
            "CUDA out of memory": runtimeVramOverflow,
        };
        for (const [key, value] of Object.entries(errorMap)) {
            if (data.includes(key)) {
                return value;
            }
        }
        return null;
    },
};
