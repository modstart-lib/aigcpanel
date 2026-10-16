import { ffprobeGetMediaDuration, ffprobeVideoInfo } from "./ffprobe";
import { t } from "../lang";

let hardwareEncodersCache: { [key: string]: boolean } | null = null;

const detectHardwareEncoders = async (): Promise<{
    [key: string]: boolean;
}> => {
    if (hardwareEncodersCache) return hardwareEncodersCache;

    const platform = $mapi.app.platformName();
    const encoders: { [key: string]: boolean } = {};

    try {
        const output = await new Promise<string>((resolve, reject) => {
            let buffer = "";
            $mapi.app.spawnBinary("ffmpeg", ["-encoders"], {
                shell: false,
                stdout: (data: string) => (buffer += data),
                stderr: (data: string) => (buffer += data),
                success: () => resolve(buffer),
                error: (msg: string) => reject(msg),
            });
        });
        // Check for common hardware encoders based on platform
        if (platform === "osx") {
            // macOS VideoToolbox
            if (output.includes("h264_videotoolbox"))
                encoders.h264_videotoolbox = true;
            if (output.includes("hevc_videotoolbox"))
                encoders.hevc_videotoolbox = true;
        } else if (platform === "win") {
            // Windows
            if (output.includes("h264_nvenc")) encoders.h264_nvenc = true;
            if (output.includes("hevc_nvenc")) encoders.hevc_nvenc = true;
            if (output.includes("h264_amf")) encoders.h264_amf = true;
            if (output.includes("hevc_amf")) encoders.hevc_amf = true;
            if (output.includes("h264_qsv")) encoders.h264_qsv = true;
            if (output.includes("hevc_qsv")) encoders.hevc_qsv = true;
        } else if (platform === "linux") {
            // Linux
            if (output.includes("h264_nvenc")) encoders.h264_nvenc = true;
            if (output.includes("hevc_nvenc")) encoders.hevc_nvenc = true;
            if (output.includes("h264_amf")) encoders.h264_amf = true;
            if (output.includes("hevc_amf")) encoders.hevc_amf = true;
            if (output.includes("h264_qsv")) encoders.h264_qsv = true;
            if (output.includes("hevc_qsv")) encoders.hevc_qsv = true;
            if (output.includes("h264_vaapi")) encoders.h264_vaapi = true;
            if (output.includes("hevc_vaapi")) encoders.hevc_vaapi = true;
        }
    } catch (e) {
        // If detection fails, assume no hardware acceleration
    }
    hardwareEncodersCache = encoders;
    return encoders;
};

const optimizeArgs = (
    args: string[],
    encoders: { [key: string]: boolean },
): string[] => {
    const optimizedArgs = [...args];
    // Replace software encoders with hardware ones if available
    for (let i = 0; i < optimizedArgs.length; i++) {
        if (optimizedArgs[i] === "-c:v") {
            const encoder = optimizedArgs[i + 1];
            if (encoder === "libx264" && encoders.h264_nvenc) {
                optimizedArgs[i + 1] = "h264_nvenc";
            } else if (encoder === "libx264" && encoders.h264_amf) {
                optimizedArgs[i + 1] = "h264_amf";
            } else if (encoder === "libx264" && encoders.h264_qsv) {
                optimizedArgs[i + 1] = "h264_qsv";
            } else if (encoder === "libx264" && encoders.h264_videotoolbox) {
                optimizedArgs[i + 1] = "h264_videotoolbox";
            } else if (encoder === "libx265" && encoders.hevc_nvenc) {
                optimizedArgs[i + 1] = "hevc_nvenc";
            } else if (encoder === "libx265" && encoders.hevc_amf) {
                optimizedArgs[i + 1] = "hevc_amf";
            } else if (encoder === "libx265" && encoders.hevc_qsv) {
                optimizedArgs[i + 1] = "hevc_qsv";
            } else if (encoder === "libx265" && encoders.hevc_videotoolbox) {
                optimizedArgs[i + 1] = "hevc_videotoolbox";
            }
        }
    }

    return optimizedArgs;
};

const extractInputFile = (args: string[]): string | null => {
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "-i" && i + 1 < args.length) {
            return args[i + 1];
        }
    }
    return null;
};

export const ffmpegOptimized = async (
    args: string[],
    option?: {
        successFileCheck?: string;
        onProgress?: (progress: number) => void;
        codesOptimized?: boolean;
    },
): Promise<void> => {
    option = Object.assign(
        {
            successFileCheck: "",
            codesOptimized: false,
            onProgress: undefined,
        },
        option,
    );

    // add hide banner and loglevel error
    if (!args.includes("-hide_banner")) {
        args.unshift("-hide_banner");
    }
    // if (!args.includes("-loglevel")) {
    //     args.unshift("-loglevel", "info");
    // }

    let optimizedArgs = args;
    if (option!.codesOptimized) {
        const encoders = await detectHardwareEncoders();
        const optimizedArgs = optimizeArgs(args, encoders);
        if (optimizedArgs.join(" ") !== args.join(" ")) {
            $mapi.log.info("FfmpegCommandOptimized", {
                original: "ffmpeg " + args.join(" "),
                optimized: "ffmpeg " + optimizedArgs.join(" "),
            });
        }
    }

    let totalDuration = 0;
    const inputFile = extractInputFile(optimizedArgs);
    if (inputFile && option?.onProgress) {
        try {
            totalDuration = await ffprobeGetMediaDuration(inputFile, false);
        } catch (e) {
            // If can't get duration, progress won't work
        }
    }

    return new Promise<void>((resolve, reject) => {
        let lastProgress = 0;
        const controller = $mapi.app.spawnBinary("ffmpeg", optimizedArgs, {
            shell: false,
            stdout: (data: string) => {
                console.log("FFmpeg stdout:", data);
            },
            stderr: (data: string) => {
                console.log("FFmpeg stderr:", data);
                if (option?.onProgress && totalDuration > 0) {
                    const timeMatch = data.match(/time=(\d+):(\d+):(\d+\.\d+)/);
                    if (timeMatch) {
                        const hours = parseInt(timeMatch[1]);
                        const minutes = parseInt(timeMatch[2]);
                        const seconds = parseFloat(timeMatch[3]);
                        const currentTime =
                            hours * 3600 + minutes * 60 + seconds;
                        const progress = Math.min(
                            currentTime / totalDuration,
                            1,
                        );
                        if (progress > lastProgress) {
                            option.onProgress(progress);
                            lastProgress = progress;
                        }
                    }
                }
            },
            success: () => {
                if (option?.onProgress) {
                    option.onProgress(1);
                }
                if (option?.successFileCheck) {
                    $mapi.file
                        .exists(option.successFileCheck)
                        .then((exists) => {
                            if (exists) {
                                resolve();
                            } else {
                                reject(
                                    `FFmpeg completed but output file not found: ${option?.successFileCheck}`,
                                );
                            }
                        })
                        .catch(reject);
                } else {
                    resolve();
                }
            },
            error: (msg: string, exitCode: number) => {
                reject(`FFmpeg error (code ${exitCode}): ${msg}`);
            },
        });
    });
};

export const ffmpegSetMediaRatio = async (
    input: string,
    output: string,
    option?: {
        ratio: number;
    },
) => {
    option = Object.assign(
        {
            ratio: 1.0,
        },
        option || {},
    );
    const ext = await $mapi.file.ext(input);
    if (!output) {
        output = await $mapi.file.temp(ext);
    }
    const buildAtempoFilter = (ratio: number): string => {
        // atempo 只支持 0.5~2.0，超过需要多次串联
        const filters: string[] = [];
        let remain = ratio;
        while (remain > 2.0) {
            filters.push("atempo=2.0");
            remain /= 2.0;
        }
        while (remain < 0.5) {
            filters.push("atempo=0.5");
            remain /= 0.5;
        }
        filters.push(`atempo=${remain}`);
        return filters.join(",");
    };

    let args: string[] = [];
    if ("mp4" === ext) {
        args = [
            "-i",
            input,
            "-filter_complex",
            `[0:v]setpts=${(1 / option.ratio).toFixed(6)}*PTS[v];[0:a]${buildAtempoFilter(option.ratio)}[a]`,
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-preset",
            "ultrafast",
            "-y",
            output,
        ];
    } else {
        args = [
            "-i",
            input,
            "-filter:a",
            buildAtempoFilter(option.ratio),
            "-vn",
            "-y",
            output,
        ];
    }

    // console.log("FFmpeg setMediaRatio args:", args.join(" "));

    return new Promise<string>(async (resolve, reject) => {
        let buffer = "";
        let called = false;
        const endCheck = async () => {
            if (await $mapi.file.exists(output)) {
                resolve(output);
            } else {
                reject("Failed to create output file");
            }
        };
        const controller = await $mapi.app.spawnBinary("ffmpeg", args, {
            shell: false,
            stdout: (data: string) => {
                // console.log("FFmpeg stdout:", data);
            },
            stderr: (data: string) => {
                // console.log("FFmpeg stderr:", data);
            },
            success: () => {
                endCheck().then();
            },
            error: (msg: string, exitCode: number) => {
                endCheck().then();
            },
        });
    });
};

const ffmpegConvertAudio = async (
    input: string,
    output?: string,
    option?: {
        channels?: number;
        sampleRate?: number;
        format?: string;
    },
) => {
    option = Object.assign(
        {
            channels: 1,
            sampleRate: 44100,
            format: "wav",
        },
        option,
    );
    if (!output) {
        output = await $mapi.file.temp(option.format);
    }
    return new Promise<string>(async (resolve, reject) => {
        const args: string[] = [
            "-i",
            input,
            "-ac",
            option.channels!.toString(),
            "-ar",
            option.sampleRate!.toString(),
            "-f",
            option.format!,
            "-y",
            output,
        ];
        // console.log("FFmpeg convertAudio args:", args.join(" "));
        const controller = await $mapi.app.spawnBinary("ffmpeg", args, {
            shell: false,
            stdout: (data: string) => {
                // console.log("FFmpeg stdout:", data);
            },
            stderr: (data: string) => {
                // console.log("FFmpeg stderr:", data);
            },
            success: () => {
                resolve(output);
            },
            error: (msg: string, exitCode: number) => {
                reject(`FFmpeg error (code ${exitCode}): ${msg}`);
            },
        });
    });
};

export type AudioRecord = {
    start: number;
    end: number;
    text: string;
    audio: string;
};

export const ffmpegMergeAudio = async (
    records: AudioRecord[],
    recordMaxMs: number,
): Promise<{
    output: string;
    cleans: string[];
    mergeRecords: (AudioRecord & {
        actualStart: number;
        actualEnd: number;
    })[];
}> => {
    const cleans: string[] = [];
    const mergeRecords: (AudioRecord & {
        actualStart: number;
        actualEnd: number;
    })[] = [];
    const wavFiles: {
        path: string;
        start: number;
    }[] = [];
    for (let i = 0; i < records.length; i++) {
        const currentRecord = records[i];
        const nextRecord = records[i + 1];
        if (
            !currentRecord.audio ||
            !(await $mapi.file.exists(currentRecord.audio))
        ) {
            throw `${t("error.audioFileNotExists")}: ${currentRecord.audio}`;
        }
        // 计算当前片段的时长限制
        const startMs = currentRecord.start;
        const maxDurationMs = nextRecord
            ? nextRecord.start - startMs
            : recordMaxMs - startMs;
        const actualDurationMs = await ffprobeGetMediaDuration(
            currentRecord.audio,
            true,
        );
        mergeRecords.push({
            start: currentRecord.start,
            end: currentRecord.end,
            actualStart: startMs,
            actualEnd: startMs + Math.min(actualDurationMs, maxDurationMs),
            text: currentRecord.text,
            audio: currentRecord.audio,
        });
        let audioFileUse = currentRecord.audio;
        // 如果音频时长超过限制，需要压缩
        if (actualDurationMs > maxDurationMs) {
            audioFileUse = await ffmpegSetMediaRatio(audioFileUse, "", {
                ratio: actualDurationMs / maxDurationMs,
            });
            cleans.push(audioFileUse);
        }
        audioFileUse = await ffmpegConvertAudio(audioFileUse);
        cleans.push(audioFileUse);
        wavFiles.push({
            path: audioFileUse,
            start: startMs,
        });
    }

    if (!wavFiles.length) {
        throw t("error.noAudioGenerated");
    }

    const output = await $mapi.file.temp("wav");
    if (wavFiles.length === 1) {
        await $mapi.file.copy(wavFiles[0].path, output);
    } else if (wavFiles.length > 1) {
        const inputs: string[] = [];
        const inputSources: string[] = [];
        const inputFilters: string[] = [];
        wavFiles.forEach((file, index) => {
            inputs.push("-i", file.path);
            inputSources.push(
                `[${index}:a]adelay=${file.start}|${file.start}[a${index}]`,
            );
            inputFilters.push(`[a${index}]`);
        });
        const filterComplex = [
            inputSources.join(";"),
            ";",
            inputFilters.join(""),
            "amix=inputs=" +
                inputSources.length +
                ":duration=longest:normalize=0",
        ].join("");
        const filterScriptFile = await $mapi.file.temp("txt");
        await $mapi.file.write(filterScriptFile, filterComplex);
        await $mapi.app.spawnBinary("ffmpeg", [
            ...inputs,
            "-filter_complex_script",
            filterScriptFile,
            output,
        ]);
    }
    // 检查合并后的音频是否存在
    if (!(await $mapi.file.exists(output))) {
        throw `${t("error.audioMergeFailed")}: ${output}`;
    }
    return {
        output,
        cleans,
        mergeRecords,
    };
};

export const ffmpegCombineVideoAudio = async (video: string, audio: string) => {
    const output = await $mapi.file.temp("mp4");
    await $mapi.app.spawnBinary("ffmpeg", [
        "-i",
        video,
        "-i",
        audio,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "0",
        "-c:a",
        "aac",
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-y",
        output,
    ]);
    // 检查最终视频是否生成成功
    if (!(await $mapi.file.exists(output))) {
        throw t("error.videoAudioSynthesisFailed");
    }
    return output;
};

export const ffmpegVideoToAudio = async (video: string) => {
    const file = await $mapi.file.temp("mp3");
    await $mapi.app.spawnBinary("ffmpeg", [
        "-y",
        "-i",
        video,
        "-vn",
        "-acodec",
        "libmp3lame",
        "-ac",
        "1",
        "-ar",
        "44100",
        file,
    ]);
    if (!(await $mapi.file.exists(file))) {
        throw t("error.audioConvertFailed");
    }
    return file;
};

export const ffmpegConcatAudio = async (audios: string[]): Promise<string> => {
    if (audios.length === 0) {
        throw t("error.noAudioProvided");
    }
    if (audios.length === 1) {
        return audios[0];
    }
    const txtFile = await $mapi.file.temp("txt");
    const lines = audios.map(
        (audio) => `file '${audio.replace(/'/g, "'\\''")}'`,
    );
    await $mapi.file.write(txtFile, lines.join("\n"));
    const output = await $mapi.file.temp("mp3");
    // mp3 128k 44100Hz 单声道
    await $mapi.app.spawnBinary("ffmpeg", [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        txtFile,
        "-c",
        "libmp3lame",
        "-b:a",
        "128k",
        "-ar",
        "44100",
        "-ac",
        "1",
        "-y",
        output,
    ]);
    if (!(await $mapi.file.exists(output))) {
        throw t("error.audioMergeFailed");
    }
    return output;
};

export const ffmpegVideoNormal = async (
    input: string,
    option: {
        widthMax?: number;
        heightMax?: number;
        fps?: number;
        durationMax?: number;
    },
): Promise<string> => {
    option = Object.assign({
        widthMax: 1920,
        heightMax: 1920,
        fps: 25,
        durationMax: -1,
    });
    const ext = await $mapi.file.ext(input);
    const output = await $mapi.file.temp(ext);
    const { width, height, duration, fps } = await ffprobeVideoInfo(input);
    let scaleFilter = "";
    let targetWidth = width;
    let targetHeight = height;
    let targetFps = fps;
    if (option.widthMax && width > option.widthMax) {
        targetWidth = option.widthMax;
        targetHeight = Math.round((option.widthMax / width) * height);
    }
    if (option.heightMax && targetHeight > option.heightMax) {
        targetHeight = option.heightMax;
        targetWidth = Math.round((option.heightMax / height) * targetWidth);
    }
    if (targetWidth !== width || targetHeight !== height) {
        scaleFilter = `scale=${targetWidth}:${targetHeight}`;
    }
    if (option.fps && fps > option.fps) {
        targetFps = option.fps;
        scaleFilter += (scaleFilter ? "," : "") + `fps=${targetFps}`;
    }
    if (
        option.durationMax &&
        option.durationMax > 0 &&
        duration > option.durationMax
    ) {
        scaleFilter +=
            (scaleFilter ? "," : "") +
            `trim=duration=${option.durationMax},setpts=PTS-STARTPTS`;
    }
    const args = [
        "-i",
        input,
        "-vf",
        scaleFilter || "null",
        "-r",
        targetFps.toString(),
        "-preset",
        "ultrafast",
        "-y",
        output,
    ];
    // console.log("FFmpeg videoNormal args:", args.join(" "));
    await $mapi.app.spawnBinary("ffmpeg", args);
    if (!(await $mapi.file.exists(output))) {
        throw t("error.videoProcessFailed");
    }
    return output;
};

// Turn a still image into a fixed-duration video (default 5s) so that an
// avatar can be created from a photo and reused by the existing video pipeline.
export const ffmpegImageToVideo = async (
    input: string,
    option?: {
        duration?: number;
        fps?: number;
        sizeMax?: number;
    },
): Promise<string> => {
    option = Object.assign(
        {
            duration: 5,
            fps: 25,
            sizeMax: 1920,
        },
        option || {},
    );
    const output = await $mapi.file.temp("mp4");
    // Fit the image into a sizeMax box keeping the aspect ratio, then force
    // both dimensions to even numbers (required by H.264 yuv420p).
    const scaleFilter = [
        `scale='min(${option.sizeMax},iw)':'min(${option.sizeMax},ih)':force_original_aspect_ratio=decrease`,
        `scale=trunc(iw/2)*2:trunc(ih/2)*2`,
        `format=yuv420p`,
    ].join(",");
    const args = [
        "-hide_banner",
        "-y",
        "-loop",
        "1",
        "-framerate",
        option.fps!.toString(),
        "-i",
        input,
        "-t",
        option.duration!.toString(),
        "-vf",
        scaleFilter,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        "-r",
        option.fps!.toString(),
        output,
    ];
    await $mapi.app.spawnBinary("ffmpeg", args);
    if (!(await $mapi.file.exists(output))) {
        throw t("error.imageToVideoFailed");
    }
    return output;
};

export const ffmpegVideoPreview = async (input: string): Promise<string> => {
    const output = await $mapi.file.temp("mp4");
    const args = [
        "-hide_banner",
        "-i",
        input,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        "-y",
        output,
    ];
    await $mapi.app.spawnBinary("ffmpeg", args);
    if (!(await $mapi.file.exists(output))) {
        throw t("error.videoPreviewConvertFailed");
    }
    return output;
};

export async function ffmpegCutVideo(
    input: string,
    startMs: number,
    endMs: number,
): Promise<string> {
    const output = await $mapi.file.temp("mp4");
    const startSeconds = startMs / 1000;
    const durationSeconds = (endMs - startMs) / 1000;
    const args = [
        "-i",
        input,
        "-ss",
        startSeconds.toString(),
        "-t",
        durationSeconds.toString(),
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "0",
        "-c:a",
        "aac",
        "-avoid_negative_ts",
        "make_zero",
        "-y",
        output,
    ];
    await ffmpegOptimized(args, {
        successFileCheck: output,
    });
    return output;
}

// FFmpeg 工具函数：合并多个视频
export async function ffmpegConcatVideos(videos: string[]): Promise<string> {
    if (videos.length === 0) {
        throw new Error("No videos to concat");
    }
    if (videos.length === 1) {
        return videos[0];
    }
    const output = await $mapi.file.temp("mp4");
    const txtFile = await $mapi.file.temp("txt");
    // 创建 concat 文件列表
    const lines = videos.map(
        (video) => `file '${video.replace(/'/g, "'\\''")}'`,
    );
    await $mapi.file.write(txtFile, lines.join("\n"));
    const args = [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        txtFile,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "0",
        "-c:a",
        "aac",
        "-y",
        output,
    ];
    await ffmpegOptimized(args, {
        successFileCheck: output,
    });
    return output;
}
