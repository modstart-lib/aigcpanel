/**
 * Helpers shared by the custom FFmpeg app: turn ffmpeg output into a short
 * failure reason, and tell which declared outputs came out missing or empty.
 */

/**
 * Phrases that mark the lines actually explaining a failure. ffmpeg also
 * writes stream metadata (`handler_name`, `vendor_id`) right before the error,
 * so taking the last lines blindly can put that noise in front of the reason.
 */
const ERROR_HINT =
    /(error|invalid|unknown|failed|failure|no such|not found|cannot|could not|unable|denied|unsupported|corrupt|missing)/i;

/**
 * ffmpeg prefixes log lines with `[component @ 0xADDR]`, which carries no
 * meaning for a user and would take the visible part of a single-line list.
 */
const AVLOG_PREFIX = /^\[[^\]]*@\s*(?:0x)?[0-9a-f]+\]\s*/i;

/**
 * Short reason for a failed ffmpeg run.
 * Spawn failures arrive as `command <args> failed with code N : <stderr>`,
 * so that prefix is stripped while the stderr text behind it is kept.
 * Lines mentioning an error win over the plain tail, so metadata written just
 * before the error does not hide it. ffmpeg separates progress lines with
 * `\r`, and the reason sits at the very end, so the summary is truncated from
 * the front, never the back.
 */
export const ffmpegOutputSummary = (raw: any): string => {
    const text = String(raw ?? "");
    const codeMatch = text.match(/failed with code (-?\d+)/);
    const body = text.replace(/^[\s\S]*?failed with code -?\d+ : /, "");
    const lines = body
        .split(/[\r\n]+/)
        .map((line) => line.trim().replace(AVLOG_PREFIX, "").trim())
        .filter((line) => line);
    const errorLines = lines.filter((line) => ERROR_HINT.test(line));
    const tailLines = (errorLines.length > 0 ? errorLines : lines).slice(-3);
    const lastLine =
        tailLines.length > 0 ? tailLines[tailLines.length - 1] : "";
    let summary = tailLines.join(" | ");
    if (summary.length > 300) {
        const head = tailLines.slice(0, -1).join(" | ");
        const room = 300 - lastLine.length - 3;
        summary =
            room > 0 && head
                ? `${head.slice(-room)} | ${lastLine}`
                : lastLine.slice(-300);
    }
    if (codeMatch) {
        summary += (summary ? " " : "") + `（退出码 ${codeMatch[1]}）`;
    }
    return summary;
};

/**
 * Which declared outputs are unusable after the run. ffmpeg can exit with
 * code 0 and still leave no file, or an empty one, when the output cannot be
 * written; such a run must not be reported as success.
 */
export const findUnusableOutputs = async (
    outputsMap: Record<string, string>,
    sizeOf: (filePath: string) => Promise<number>,
): Promise<string[]> => {
    const unusable: string[] = [];
    for (const key in outputsMap || {}) {
        const filePath = outputsMap[key];
        if (!filePath) {
            continue;
        }
        if ((await sizeOf(filePath)) <= 0) {
            unusable.push(`${key} ${filePath}`);
        }
    }
    return unusable;
};
