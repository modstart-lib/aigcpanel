// Highlighting helpers. They return plain segments instead of an HTML string,
// so callers render with Vue interpolation and injected content can never be
// interpreted as markup.

export interface HighlightSegment {
    text: string;
    hit: boolean;
}

export interface HighlightRange {
    index: number;
    length: number;
}

const mergeRanges = (ranges: HighlightRange[]): HighlightRange[] => {
    const sorted = ranges
        .filter((range) => range.length > 0 && range.index >= 0)
        .sort((a, b) => a.index - b.index);
    const merged: HighlightRange[] = [];
    for (const range of sorted) {
        const last = merged[merged.length - 1];
        if (last && range.index <= last.index + last.length) {
            last.length = Math.max(
                last.length,
                range.index + range.length - last.index,
            );
        } else {
            merged.push({ index: range.index, length: range.length });
        }
    }
    return merged;
};

/**
 * Split text into plain and highlighted segments. Overlapping ranges are
 * merged, so the result is always a flat, non-nested list.
 */
export function highlightSegments(
    text: string | null | undefined,
    ranges: HighlightRange[],
): HighlightSegment[] {
    const source = String(text ?? "");
    if (!source) {
        return [];
    }
    const merged = mergeRanges(ranges);
    if (!merged.length) {
        return [{ text: source, hit: false }];
    }
    const segments: HighlightSegment[] = [];
    let cursor = 0;
    for (const range of merged) {
        if (range.index > cursor) {
            segments.push({
                text: source.slice(cursor, range.index),
                hit: false,
            });
        }
        segments.push({
            text: source.slice(range.index, range.index + range.length),
            hit: true,
        });
        cursor = range.index + range.length;
    }
    if (cursor < source.length) {
        segments.push({ text: source.slice(cursor), hit: false });
    }
    return segments;
}

/** Literal, case-insensitive keyword matches in `text`. */
export function keywordRanges(
    text: string | null | undefined,
    keyword: string | null | undefined,
): HighlightRange[] {
    const source = String(text ?? "");
    const needle = String(keyword ?? "");
    if (!source || !needle.trim()) {
        return [];
    }
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const ranges: HighlightRange[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
        if (match[0].length === 0) {
            regex.lastIndex += 1;
            continue;
        }
        ranges.push({ index: match.index, length: match[0].length });
    }
    return ranges;
}
