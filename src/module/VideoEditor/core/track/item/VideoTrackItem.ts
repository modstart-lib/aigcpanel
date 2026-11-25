import { OffscreenSprite } from "@webav/av-cliper";
import { StringUtil } from "../../../../../lib/util";
import { VIDEO_PREVIEW_FIXED_FPS } from "../../config";
import { UnitFrame2us } from "../config";
import { splitClip, videoDecoder } from "../decoder";
import {
    BaseMediaTrackItem,
    BaseTrackItem,
    BaseTrackItemOption,
    BaseVisibleTrackItem,
    TrackItemType,
    TrackResizeOption,
    VideoTrackSource,
} from "../type";

export class VideoTrackItem
    implements BaseTrackItem, BaseVisibleTrackItem, BaseMediaTrackItem
{
    id: string;
    type: TrackItemType = "video";
    name: string;
    start: number;
    end: any;
    frameCount: number;
    format: string;
    source: VideoTrackSource;
    option: BaseTrackItemOption;

    centerX = 0;
    centerY = 0;
    scaleX = 100;
    scaleY = 100;
    width = 0;
    height = 0;

    offsetL: number;
    offsetR: number;

    constructor(source: VideoTrackSource, option: BaseTrackItemOption = {}) {
        // base
        source.id = source.id || StringUtil.random(32);
        source.duration = source.duration || 5;
        this.id = source.id;
        this.name = source.name;
        this.frameCount = source.duration * VIDEO_PREVIEW_FIXED_FPS;
        this.start = source.start || 0;
        this.end = this.start + this.frameCount;
        this.format = source.format;
        this.source = source;
        this.option = option;
        // visible
        this.centerX = source.centerX!;
        this.centerY = source.centerY!;
        this.scaleX = source.scaleX!;
        this.scaleY = source.scaleY!;
        this.height = source.height!;
        this.width = source.width!;
        // media
        this.offsetL = 0;
        this.offsetR = 0;
        // others
    }

    destroy() {
        if (this._audio) {
            this._audio.pause();
            this._audio.src = "";
            this._audio = null;
        }
    }

    get drawHeight() {
        return (this.height * this.scaleY) / 100;
    }

    get drawWidth() {
        return (this.width * this.scaleX) / 100;
    }

    getDrawX(width: number) {
        return width / 2 - this.drawWidth / 2 + this.centerX;
    }

    getDrawY(height: number) {
        return height / 2 - this.drawHeight / 2 + this.centerY;
    }

    draw(
        ctx: CanvasRenderingContext2D,
        { width, height }: { width: number; height: number },
        frameIndex: number,
    ) {
        const frame = Math.max(frameIndex - this.start + this.offsetL, 1); // 默认展示首帧
        const start = performance.now();
        return videoDecoder
            .getFrame(this.source.id!, frame)
            .then(async (vf) => {
                // console.log('VideoTrackItem.GetFrame', {id: this.source.id, frame, cost: performance.now() - start, vf});
                if (vf) {
                    ctx.drawImage(
                        vf,
                        0,
                        0,
                        this.source.width!,
                        this.source.height!,
                        this.getDrawX(width),
                        this.getDrawY(height),
                        this.drawWidth,
                        this.drawHeight,
                    );
                    vf?.close();
                }
            });
    }

    resize(
        { width, height }: { width: number; height: number },
        option: TrackResizeOption = {},
    ) {
        // 视频、图片元素，在添加到画布中时，需要缩放为合适的尺寸，目标是能在画布中完整显示内容
        let scale = 1;
        if (this.source.width! > width) {
            scale = width / this.source.width!;
        }
        if (this.source.height! > height) {
            scale = Math.min(scale, height / this.source.height!);
        }
        if (option.init && this.option.initScale) {
            scale = scale * this.option.initScale;
        }
        this.width = this.source.width! * scale;
        this.height = this.source.height! * scale;
    }

    _audio: HTMLAudioElement | null = null;
    _audioUrl: string | null = null;
    _audioPlayLoading: boolean = false;

    async getAudioUrl() {
        if (this._audioUrl) {
            let localFile = this._audioUrl.replace(/^file:\/\//, "");
            if (await $mapi.file.exists(localFile)) {
                return this._audioUrl;
            }
        }
        const wavTemp = await $mapi.file.temp("wav");
        let localFile = this.source.url.replace(/^file:\/\//, "");
        await $mapi.app.spawnBinary("ffmpeg", [
            "-y",
            "-i",
            localFile,
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "44100",
            "-ac",
            "2",
            wavTemp,
        ]);
        this._audioUrl = "file://" + wavTemp;
        return this._audioUrl;
    }

    play(currentFrame: number) {
        // 音频播放逻辑暂时注释，避免资源占用
        if (!this._audio && !this._audioPlayLoading) {
            this._audioPlayLoading = true;
            this.getAudioUrl()
                .then((url) => {
                    this._audio = new Audio(url);
                    this._audioPlayLoading = false;
                })
                .catch((e) => {
                    // 提取音轨失败（如源文件损坏、ffmpeg 报错）：不阻塞预览
                    console.error("VideoTrackItem.getAudioUrl", e);
                    this._audioPlayLoading = false;
                });
        }
        if (!this._audioPlayLoading && this._audio && this._audio!.paused) {
            this._audio!.currentTime =
                (currentFrame - this.start - this.offsetL) /
                VIDEO_PREVIEW_FIXED_FPS;
            this._audio!.play();
        }
    }

    pause() {
        if (this._audio && !this._audio.paused) {
            this._audio.pause();
        }
    }

    // 生成合成对象
    async combine(
        playerSize: { width: number; height: number },
        outputRatio: number,
    ) {
        const video = await videoDecoder.decode({ id: this.source.id! });
        const clip = await splitClip(video!, {
            offsetL: this.offsetL,
            offsetR: this.offsetR,
            frameCount: this.frameCount,
        });
        if (!clip) {
            throw new Error("clip is not ready");
        }
        const spr = new OffscreenSprite(clip);
        // TODO：需要支持裁剪
        spr.time = {
            offset: this.start * UnitFrame2us,
            duration: (this.end - this.start) * UnitFrame2us,
        };
        spr.rect.x = this.getDrawX(playerSize.width) * outputRatio;
        spr.rect.y = this.getDrawY(playerSize.height) * outputRatio;
        spr.rect.w = this.drawWidth * outputRatio;
        spr.rect.h = this.drawHeight * outputRatio;

        return spr;
    }

    split(cutFrame: number) {
        this.end = cutFrame;
        this.offsetR = this.frameCount + this.start - cutFrame; // 根据cutFrame对视频进行分割
        // 根据cutFrame对视频进行分割
        const copy = new VideoTrackItem({
            ...this.source,
            start: cutFrame,
        });

        copy.offsetL = cutFrame - this.start;
        return copy;
    }
}
