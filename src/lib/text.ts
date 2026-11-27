/**
 * 文本切分与长度工具。
 *
 * 与 `src/lib/subtitle.ts` 共用「按分隔符切分」的机制，但标点策略由调用方决定：
 * 长文本转音频需要保留原标点，字幕行需要丢弃标点后按长度重排。
 */

/**
 * 按分隔符切分文本。
 *
 * 分隔符只接受正则；内部统一重建为全局匹配，避免调用方传入的正则携带残留
 * `lastIndex`，空匹配也会强制推进一位，防止死循环。
 *
 * - `keepDelimiters: true`：分隔符留在前一段末尾，`parts.join("")` 还原原文。
 * - `keepDelimiters: false`：只返回被分隔符隔开的文本片段，并去掉空片段。
 */
export function splitByDelimiters(
    text: string,
    delimiters: RegExp,
    option?: { keepDelimiters?: boolean },
): string[] {
    const keepDelimiters = option?.keepDelimiters === true;
    const re = new RegExp(
        delimiters.source,
        delimiters.flags.includes("g")
            ? delimiters.flags
            : delimiters.flags + "g",
    );
    const parts: string[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
        if (match[0].length === 0) {
            // 空匹配无法前进，跳过当前字符继续
            re.lastIndex = match.index + 1;
            continue;
        }
        const end = match.index + match[0].length;
        parts.push(text.slice(last, keepDelimiters ? end : match.index));
        last = end;
    }
    parts.push(text.slice(last));
    return parts.filter((p) => p.length > 0);
}

/**
 * 按字符数计长度（码点，不拆代理对）。
 * 用于「分片不超过 N 字」这类硬上限，不做中英文加权。
 */
export function textLength(text: string): number {
    return Array.from(text).length;
}

/**
 * 文本长度（中文字 1、英文数字 0.5、标点空格不计，向上取整）。
 * 用于字幕行的版面预算，与字符数口径不同。
 */
export function measureTextLength(text: string): number {
    let length = 0;
    let letterCount = 0;
    for (const char of text) {
        if (/[\u4e00-\u9fff]/.test(char)) {
            // 中文字符
            length += 1;
        } else if (/[a-zA-Z0-9]/.test(char)) {
            letterCount += 1;
        }
        // 标点和空格不算
    }
    length += Math.ceil(letterCount / 2);
    return length;
}

/** 只有空白与标点的片段对合成没有意义 */
const fillerOnly = (text: string): boolean => /^[\s\p{P}]*$/u.test(text);

/** 超长片段没有可用断点时按长度切开，切点尽量落在 breakChars 之后 */
const cutByLength = (
    text: string,
    limit: number,
    breakChars: string,
): string[] => {
    const chars = Array.from(text);
    const pieces: string[] = [];
    let start = 0;
    while (chars.length - start > limit) {
        let cut = start + limit;
        for (let i = cut - 1; i > start; i--) {
            if (breakChars.includes(chars[i])) {
                cut = i + 1;
                break;
            }
        }
        pieces.push(chars.slice(start, cut).join(""));
        start = cut;
    }
    if (start < chars.length) {
        pieces.push(chars.slice(start).join(""));
    }
    // 最后一段只剩标点时，从上一段尾部借字，避免出现「。」这种单独一段
    while (pieces.length > 1) {
        const last = Array.from(pieces[pieces.length - 1]);
        if (!fillerOnly(pieces[pieces.length - 1]) || last.length >= limit) {
            break;
        }
        const prev = Array.from(pieces[pieces.length - 2]);
        if (prev.length <= 1) {
            break;
        }
        pieces[pieces.length - 2] = prev.slice(0, -1).join("");
        pieces[pieces.length - 1] = prev[prev.length - 1] + last.join("");
    }
    return pieces;
};

/**
 * 按分隔符分句后装包成不超过 `maxLength` 的片段。
 *
 * - 优先在分隔符处切；单个句子超过上限时先按 `breakChars`（空格、逗号等）
 *   回退，仍切不开才按字符硬切。
 * - 长度预算按最终片段文本的字符数计，包含保留下来的标点。
 * - 不做 trim，纯空白片段直接丢弃，其余片段拼接后与原文字符一致。
 */
export function splitTextByLength(
    text: string,
    maxLength: number,
    option?: { delimiters?: RegExp; breakChars?: string },
): string[] {
    const limit = maxLength > 0 ? maxLength : 1;
    const breakChars = option?.breakChars ?? " ，,、；;：:。！？!?.";
    const delimiters = option?.delimiters;
    const segments = delimiters
        ? splitByDelimiters(text, delimiters, { keepDelimiters: true })
        : [text];
    const chunks: string[] = [];
    let current = "";
    const push = (piece: string) => {
        if (piece.trim()) {
            chunks.push(piece);
        }
    };
    for (const segment of segments) {
        if (textLength(current) + textLength(segment) <= limit) {
            current += segment;
            continue;
        }
        if (current) {
            push(current);
            current = "";
        }
        if (textLength(segment) <= limit) {
            current = segment;
            continue;
        }
        const pieces = cutByLength(segment, limit, breakChars);
        for (let i = 0; i < pieces.length - 1; i++) {
            push(pieces[i]);
        }
        current = pieces[pieces.length - 1] || "";
    }
    if (current) {
        push(current);
    }
    return chunks;
}
