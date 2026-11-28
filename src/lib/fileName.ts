/**
 * File-name helpers shared by the main process (`$mapi.file.textToName`) and
 * the renderer (batch download). Keeping one implementation means a name built
 * in either place follows the same rules.
 */

// Characters that cannot appear in a file name. Path separators matter most:
// when a name is joined into a path, "/" or "\" would let it escape the
// directory the user picked.
const ILLEGAL_CHARS = /[\\\/\:\*\?\"\<\>\|]/g;

/**
 * Turn arbitrary text (a task title, a prompt, …) into a legal file name base.
 * Mirrors the historical `textToName` behaviour: illegal characters, line
 * breaks and whitespace are dropped, the result is truncated and never empty.
 */
export const sanitizeFileNameBase = (text: string, maxLimit: number = 100) => {
    let name = String(text || "");
    if (name) {
        name = name.replace(ILLEGAL_CHARS, "");
        name = name.replace(/[\r\n]/g, "");
        name = name.replace(/\s+/g, "");
        name = name.substring(0, maxLimit);
    }
    if (!name) {
        name = "EMPTY";
    }
    return name;
};

export type DownloadTargetState =
    // nothing with this name was in the folder before the batch
    | "new"
    // title repeats inside the batch, so a "(2)", "(3)"… suffix was added
    | "duplicated"
    // a file with this name already existed in the folder before the batch
    | "skipped";

export type DownloadTarget = {
    fileName: string;
    path: string;
    state: DownloadTargetState;
};

const nameKey = (fileName: string) => fileName.toLowerCase();

/**
 * Decide where each downloaded record lands inside `dir`.
 *
 * - The first record of a title keeps the plain name; further records sharing
 *   that title in the same batch get "(2)", "(3)"… so none of them is lost.
 * - A name that already exists in the folder before the batch is skipped (the
 *   previous behaviour, nothing is overwritten) and reported as `skipped`, so
 *   the caller can tell the user instead of claiming a plain success.
 * - `title` is sanitized here: a title never decides the directory it lands in.
 */
export const planDownloadTargets = async (option: {
    dir: string;
    items: { title: string; ext: string }[];
    exists: (path: string) => Promise<boolean>;
}): Promise<DownloadTarget[]> => {
    const used = new Set<string>();
    const targets: DownloadTarget[] = [];
    for (const item of option.items) {
        const baseName = sanitizeFileNameBase(item.title || "");
        // A stored extension is normally alphanumeric, but it is joined into a
        // path too, so separators are dropped for the same reason as above.
        const safeExt = String(item.ext || "").replace(/[\\\/]/g, "");
        const nameExt = safeExt ? `.${safeExt}` : "";
        const firstName = `${baseName}${nameExt}`;
        const firstPath = `${option.dir}/${firstName}`;
        const firstKey = nameKey(firstName);
        if (!used.has(firstKey)) {
            used.add(firstKey);
            targets.push({
                fileName: firstName,
                path: firstPath,
                state: (await option.exists(firstPath)) ? "skipped" : "new",
            });
            continue;
        }
        // The same title appeared earlier in this batch: number it until both
        // the batch and the folder are free.
        let index = 2;
        while (true) {
            const fileName = `${baseName}(${index})${nameExt}`;
            const path = `${option.dir}/${fileName}`;
            const key = nameKey(fileName);
            if (!used.has(key) && !(await option.exists(path))) {
                used.add(key);
                targets.push({ fileName, path, state: "duplicated" });
                break;
            }
            index++;
        }
    }
    return targets;
};
