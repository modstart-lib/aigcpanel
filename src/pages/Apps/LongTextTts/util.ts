import { splitTextByLength } from "../../../lib/text";

/**
 * 句末分隔符：
 * - 中英文句末标点与省略号，连同紧跟的右引号 / 右括号与空白一起切；
 * - 换行按句切；
 * - ASCII 句点只有在非数字之后、且后面是空白或文本结尾时才算句末，
 *   避免把 3.14、v2.7.0 这类数字写法切开。
 */
const SENTENCE_END =
    /[。！？!?；;…]+[”’」』】）)"']*\s*|\r\n|\n|\r|(?<!\d)\.(?=\s|$)\s*/;

export function splitText(
    text: string,
    maxLength: number = 150,
): { text: string }[] {
    return splitTextByLength(text, maxLength, {
        delimiters: SENTENCE_END,
        breakChars: " ，,、；;：:。！？!?.",
    }).map((t) => ({ text: t.trim() }));
}
