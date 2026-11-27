import { AudioRecord } from "./ffmpeg";
import { measureTextLength, splitByDelimiters } from "./text";

export function subtitleGenerateSrtContent(
    records: { start: number; end: number; text: string }[],
): string {
    let subtitleText = "";
    let index = 1;
    const formatMs = (ms: number) => {
        ms = Math.floor(ms);
        const hour = Math.floor(ms / 3600000);
        const minute = Math.floor((ms % 3600000) / 60000);
        const second = Math.floor((ms % 60000) / 1000);
        const millisecond = ms % 1000;
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")},${String(millisecond).padStart(3, "0")}`;
    };
    for (const record of records) {
        const start = formatMs(record.start);
        const end = formatMs(record.end);
        subtitleText += `${index}\n${start} --> ${end}\n${record.text}\n\n`;
        index++;
    }
    return subtitleText;
}

export function subtitleGenerateRecords(
    records: AudioRecord[],
    option?: {
        lineLimit: number;
    },
): AudioRecord[] {
    option = Object.assign(
        {
            lineLimit: 30,
        },
        option,
    );

    const calculateCharCount = (text: string): number => {
        let count = 0;
        for (const char of text) {
            if (/[\u4e00-\u9fff]/.test(char) || /[a-zA-Z]/.test(char)) {
                count += 1;
            }
        }
        return count;
    };

    const splitWordByChar = (word: string, lineLimit: number): string[] => {
        const parts: string[] = [];
        let current = "";
        let currentLength = 0;
        for (const char of word) {
            let charLen = 0;
            if (/[\u4e00-\u9fff]/.test(char)) {
                charLen = 1;
            } else if (/[a-zA-Z]/.test(char)) {
                charLen = 0.5;
            }
            if (currentLength + charLen > lineLimit) {
                if (current) {
                    parts.push(current);
                    current = "";
                    currentLength = 0;
                }
                current += char;
                currentLength += charLen;
            } else {
                current += char;
                currentLength += charLen;
            }
        }
        if (current) {
            parts.push(current);
        }
        return parts;
    };

    const splitPart = (part: string, lineLimit: number): string[] => {
        const words = part.split(/\s+/);
        const subParts: string[] = [];
        let current = "";
        let currentLength = 0;
        for (const word of words) {
            if (!word) continue;
            const wordLength = measureTextLength(word);
            if (wordLength > lineLimit) {
                // 单词本身超过，需要按字符分割单词
                const charParts = splitWordByChar(word, lineLimit);
                for (const charPart of charParts) {
                    const charLength = measureTextLength(charPart);
                    if (currentLength + charLength > lineLimit) {
                        if (current) {
                            subParts.push(current);
                            current = "";
                            currentLength = 0;
                        }
                    }
                    if (current) {
                        current += " " + charPart;
                    } else {
                        current = charPart;
                    }
                    currentLength += charLength;
                }
            } else {
                // 正常处理单词
                if (currentLength + wordLength > lineLimit) {
                    if (current) {
                        subParts.push(current);
                        current = "";
                        currentLength = 0;
                    }
                }
                if (current) {
                    current += " " + word;
                } else {
                    current = word;
                }
                currentLength += wordLength;
            }
        }
        if (current) {
            subParts.push(current);
        }
        return subParts;
    };

    const subtitles: AudioRecord[] = [];
    for (const record of records) {
        // 按标点和空格切分，字幕行内不保留这些分隔符
        const readableParts = splitByDelimiters(record.text, /[。！？，,\s]+/);
        // console.log('parts', {readableParts});

        // 拼接可读部分
        const subtitleTexts: string[] = [];
        let currentText = "";
        let currentLength = 0;
        for (const part of readableParts) {
            const partLength = measureTextLength(part);
            // console.log('part', {part, partLength, currentLength, currentText});
            if (partLength > option.lineLimit) {
                // 分割 part
                const subParts = splitPart(part, option.lineLimit);
                // console.log('subParts',{subParts})
                for (const subPart of subParts) {
                    const subLength = measureTextLength(subPart);
                    if (currentLength + subLength <= option.lineLimit) {
                        if (currentText) {
                            currentText += " " + subPart;
                        } else {
                            currentText = subPart;
                        }
                        currentLength += subLength;
                    } else {
                        if (currentText) {
                            subtitleTexts.push(currentText);
                        }
                        currentText = subPart;
                        currentLength = subLength;
                    }
                }
            } else {
                // 正常处理
                if (currentLength + partLength <= option.lineLimit) {
                    if (currentText) {
                        currentText += " " + part;
                    } else {
                        currentText = part;
                    }
                    currentLength += partLength;
                } else {
                    if (currentText) {
                        subtitleTexts.push(currentText);
                    }
                    currentText = part;
                    currentLength = partLength;
                }
            }
        }
        if (currentText) {
            subtitleTexts.push(currentText);
        }
        // console.log('line', {text: record.text, subtitleTexts, readableParts});

        // 计算总字符数用于比例分配；纯数字 / 假名等算不出字符数时按条数均分
        const totalChars = calculateCharCount(record.text);
        let cumulativeRatio = 0;
        for (const subtitleText of subtitleTexts) {
            const charCount = calculateCharCount(subtitleText);
            const timeRatio =
                totalChars > 0
                    ? charCount / totalChars
                    : 1 / subtitleTexts.length;
            const start =
                record.start + (record.end - record.start) * cumulativeRatio;
            const end =
                record.start +
                (record.end - record.start) * (cumulativeRatio + timeRatio);
            subtitles.push({
                ...record,
                start: start,
                end: end,
                text: subtitleText,
            });
            cumulativeRatio += timeRatio;
        }
    }
    return subtitles;
}

export type SubtitleEntry = {
    start: number;
    end: number;
    text: string;
};
export const subtitleParseSrtFile = async (
    srtFilePath: string,
): Promise<SubtitleEntry[]> => {
    const content = await $mapi.file.read(srtFilePath, { isDataPath: false });
    const entries: SubtitleEntry[] = [];

    // SRT格式解析
    const blocks = content.trim().split("\n\n");

    for (const block of blocks) {
        const lines = block.trim().split("\n");
        if (lines.length < 3) continue;

        const timeMatch = lines[1].match(
            /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/,
        );
        if (!timeMatch) continue;

        const startMs =
            parseInt(timeMatch[1]) * 3600000 +
            parseInt(timeMatch[2]) * 60000 +
            parseInt(timeMatch[3]) * 1000 +
            parseInt(timeMatch[4]);
        const endMs =
            parseInt(timeMatch[5]) * 3600000 +
            parseInt(timeMatch[6]) * 60000 +
            parseInt(timeMatch[7]) * 1000 +
            parseInt(timeMatch[8]);
        const text = lines.slice(2).join("\n");

        entries.push({ start: startMs * 1000, end: endMs * 1000, text });
    }

    return entries;
};
