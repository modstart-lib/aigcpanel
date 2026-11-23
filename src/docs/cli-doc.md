# CLI 工具文档

AIGCPanel CLI 是一个命令行工具，可通过终端直接调用模型服务和内置工具，适用于自动化脚本和 CI/CD 集成。CLI 通过本机 HTTP 接口与正在运行的 AIGCPanel 通信，命令执行会等待任务结束再输出结果。

---

## 安装

CLI 工具位于 AIGCPanel 安装目录的 `bin/` 子目录中。

### macOS

```bash
sudo ln -sf /Applications/AIGCPanel.app/Contents/Resources/bin/aigcpanel /usr/local/bin/aigcpanel
```

### Linux

```bash
mkdir -p ~/.local/bin
ln -sf /path/to/aigcpanel/resources/bin/aigcpanel ~/.local/bin/aigcpanel
```

如果 `~/.local/bin` 不在 PATH 中，请添加以下内容到 shell 配置文件：

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Windows

将工具路径所在目录添加到系统 PATH 环境变量：
右键「此电脑」→ 属性 → 高级系统设置 → 环境变量 → 在 Path 中添加上方目录路径

---

## 命令列表

| 命令 | 说明 |
|------|------|
| `version` | 查看 CLI 版本号 |
| `serverList` | 列出已安装的 AI 模型服务 |
| `serverInstall` | 从本地目录安装模型 |
| `serverRemove` | 卸载已安装的模型 |
| `serverCall` | 调用模型能力并等待结果 |
| `serverSetting` | 设置模型服务参数 |
| `serverLog` | 查看模型服务日志 |
| `serverPrepare` | 下载/校验模型权重，或查询下载状态 |
| `serverComfyuiList` | 列出 ComfyUI 模型的工作流（VIP） |
| `tools` | 调用内置工具并等待结果 |

---

## 基本用法

### 查看版本

```bash
aigcpanel version
```

### 查看已安装模型列表

```bash
aigcpanel serverList
```

返回每项包含 `name`、`version`、`title`、`type`、`functions`、`settings` 等字段。

### 安装模型

```bash
aigcpanel serverInstall --dir /path/to/model-dir
```

目录中必须包含 `config.json`。同名同版本会覆盖（upsert）。

### 卸载模型

```bash
aigcpanel serverRemove --server server-demo
aigcpanel serverRemove --server "server-demo|1.1.0"
```

`--server` 支持 `name` 或 `name|version`；只写名称且存在多个版本时会报错，需要带上版本。权重正在下载时需先 `serverPrepare --pause`。

### 调用模型能力

```bash
aigcpanel serverCall --server <name|version> --function <能力名> [--key value ...]
```

| 参数 | 说明 |
|------|------|
| `--server` | 必填，`name` 或 `name|version` |
| `--function` | 必填，能力名：`soundTts`、`soundClone`、`videoGen`、`asr`、`textToImage`、`imageToImage`、`textToVideo`、`imageToVideo`、`comfyui`、`general` |
| `--comfyuiName` | `--function comfyui` 时选择工作流 |
| `--generalName` | `--function general` 时选择具体通用能力 |
| `--timeout` | 轮询超时秒数，默认 600 |
| `--param` | JSON 对象，作为函数参数的一部分 |
| `--key value` | 其余参数按扁平键值传入；`--keyJson <文件>` 可传 JSON 值 |

示例：

```bash
aigcpanel serverCall --server server-demo --function soundTts --text "你好"
aigcpanel serverCall --server server-demo --function asr --audio /path/to/a.wav
aigcpanel serverCall --server server-ComfyUI --function comfyui \
  --comfyuiName textToImageFlux --param '{"width":512,"height":512}'
aigcpanel serverCall --server server-demo --function general \
  --generalName generalImage --prompt "一只猫" --count 2
```

### 查看服务日志

```bash
aigcpanel serverLog --server server-demo
aigcpanel serverLog --server server-demo --json
```

### 设置服务参数

```bash
aigcpanel serverSetting --server server-ComfyUI --gpu 0 --idleTimeout 120
```

除 `--server` 外的 `--key value` 都会合并进模型设置；`--keyJson <文件>` 用于 JSON 值。

### 下载模型权重

```bash
# 等待下载完成
aigcpanel serverPrepare --server IndexTTS25

# 只查询当前状态
aigcpanel serverPrepare --server "server-IndexTTS25|1.0.0" --status

# 暂停下载（保留已下载分片，后续可续传）
aigcpanel serverPrepare --server IndexTTS25 --pause
```

`--cancel` 是 `--pause` 的别名。

### 列出 ComfyUI 工作流

```bash
aigcpanel serverComfyuiList --server "server-ComfyUI|1.0.0"
aigcpanel serverComfyuiList --server server-ComfyUI --json
```

普通用户只返回 `vip: false`；VIP 用户可拿到 `key`、`title`、`description`、`biz`、`hasUserConfig`，加 `--json` 还会返回完整 `param` 定义。

### 调用工具

```bash
aigcpanel tools --name <工具类型> --param '{"参数名":"值",...}'
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| `--name` | 必填，工具类型名称 |
| `--param` | 工具参数 JSON 字符串，提交时作为 modelConfig 传入 |
| `--taskId` / `--stage` | 继续暂停的任务时使用；此时 `--param` 作为该阶段的数据 |

命令会等待任务结束并输出结果。带人工确认步骤的工具（视频片段放大、视频标注、视频片段变速、视频片段删除/保留、智能剪辑）会先返回暂停状态，需要再用 `--taskId` + `--stage` 继续。

---

## 工具列表

工具分两类：

- **模型能力类**：文生图、图生图、文生视频、图生视频、语音合成、语音识别、长文本转音频、字幕转音频、声音替换、数字人合成等，需要指定模型，推荐直接用 `serverCall`。
- **系统工具类**：视频处理、格式转换、FFmpeg 等，不依赖模型，用 `tools --name` 调用，`--param` 就是该工具的 `modelConfig`。

### 模型能力

```bash
# 语音合成
aigcpanel serverCall --server <模型> --function soundTts --text "你好世界"

# 语音识别
aigcpanel serverCall --server <模型> --function asr --audio /path/to/audio.wav

# 数字人合成
aigcpanel serverCall --server <模型> --function videoGen \
  --video /path/to/face.mp4 --audio /path/to/audio.wav

# 文生图 / 图生图
aigcpanel serverCall --server <模型> --function textToImage --prompt "美丽的山水风景"
aigcpanel serverCall --server <模型> --function imageToImage \
  --image /path/to/image.png --prompt "油画风格"

# 文生视频 / 图生视频
aigcpanel serverCall --server <模型> --function textToVideo --prompt "海边日落，镜头缓慢推进"
aigcpanel serverCall --server <模型> --function imageToVideo \
  --images '["/path/to/image.png"]' --prompt "镜头缓慢推进"
```

模型能力的参数名见对应功能文档；`comfyui` 和 `general` 能力分别用 `--comfyuiName`、`--generalName` 选择具体工作流/子能力。

长文本转音频、字幕转音频、声音替换这类组合工具，对应 `tools` 的 `LongTextTts`、`SubtitleTts`、`SoundReplace`，`--param` 需要带完整模型配置，结构较复杂；如果不是自动化脚本，建议在界面里提交。

### 系统工具

> 系统工具的 `--param` 就是任务里的 `modelConfig`，界面上的默认值不会由 CLI 补齐；下面的示例已带上主要默认值，字段含义见 AIGCPanel 使用文档里的对应工具页面。

#### 声音归一化

```bash
aigcpanel tools --name AudioNormal --param '{"file":"/path/to/audio.wav","normalizationPercentage":100}'
```

#### Ffmpeg 处理

```bash
aigcpanel tools --name Ffmpeg --param '{"input1":"/path/to/input.mp4","commands":["-i","{input1:mp4}","-vf","scale=1280:720","{output1:mp4}"]}'
```

`input1` ~ `input5` 依次对应模板里的 5 个输入文件；`commands` 是完整参数数组，用 `{inputN:扩展名}`、`{outputN:扩展名}` 引用输入/输出文件，软件会把它们替换成实际路径。

#### 媒体格式转换

```bash
aigcpanel tools --name MediaFormatConvert --param '{"media":"/path/to/video.mp4","targetFormat":"mp4","videoCodec":"libx264","audioCodec":"aac","videoBitrate":2000,"audioBitrate":128,"lossless":false}'
```

#### 视频背景

```bash
aigcpanel tools --name VideoBackground --param '{"video":"/path/to/video.mp4","image":"/path/to/bg.png","imageMode":"cover","videoX":96,"videoY":54,"videoWidth":1728,"videoHeight":972,"outputWidth":1920,"outputHeight":1080,"videoBorderWidth":30,"videoBorderColor":"#FFFFFF","videoBorderOpacity":50,"videoBorderRadius":30}'
```

#### 更换视频背景

```bash
aigcpanel tools --name VideoBackgroundReplace --param '{"video":"/path/to/green.mp4","image":"/path/to/bg.png","imageMode":"cover","keyColor":"#00FF00","similarity":0.3,"blend":0.1,"outputWidth":0,"outputHeight":0}'
```

#### 视频压缩

```bash
aigcpanel tools --name VideoCompress --param '{"file":"/path/to/video.mp4","codec":"libx264","resolution":"1920x1080","compressionLevel":50}'
```

#### 视频片段删除/保留

```bash
aigcpanel tools --name VideoKeepPart --param '{"video":"/path/to/video.mp4","action":"remove"}'
```

`action` 取 `keep` 或 `remove`。

#### 视频标注

```bash
aigcpanel tools --name VideoMark --param '{"video":"/path/to/video.mp4","borderColor":"#ff0000","borderWidth":10,"borderOpacity":50,"borderRadius":10,"borderStyle":"solid"}'
```

#### 视频合并

```bash
aigcpanel tools --name VideoMerge --param '{"videos":["/path/to/video1.mp4","/path/to/video2.mp4"],"transitionEffect":"none","transitionDuration":500}'
```

#### 视频添加音频

```bash
aigcpanel tools --name VideoMergeAudio --param '{"video":"/path/to/video.mp4","audio":"/path/to/audio.wav"}'
```

#### 片头片尾图片

```bash
aigcpanel tools --name VideoMergeImage --param '{"video":"/path/to/video.mp4","image":"/path/to/image.png","position":"start","duration":3,"animation":"none","zoomPercent":5}'
```

#### 视频尺寸转换

```bash
aigcpanel tools --name VideoSizeConvert --param '{"video":"/path/to/video.mp4","targetWidth":1280,"targetHeight":720,"fillMode":"black"}'
```

#### 视频全局变速

```bash
aigcpanel tools --name VideoSpeed --param '{"video":"/path/to/video.mp4","speed":1.5}'
```

#### 视频片段变速

```bash
aigcpanel tools --name VideoSpeedPart --param '{"video":"/path/to/video.mp4","speed":5}'
```

#### 视频添加字幕

```bash
aigcpanel tools --name VideoSubtitle --param '{"video":"/path/to/video.mp4","subtitle":"/path/to/subtitle.srt"}'
```

#### 视频片段放大

```bash
aigcpanel tools --name VideoZoom --param '{"video":"/path/to/video.mp4","zoomDurationMs":500}'
```

### 需要人工确认的工具

视频片段放大、视频标注、视频片段变速、视频片段删除/保留、智能剪辑会先返回暂停状态。拿到 `taskId` 和当前 `step` 后继续：

```bash
aigcpanel tools --name VideoZoom --taskId 123 --stage Config \
  --param '{"times":[{"startMs":500,"endMs":2500}]}'
```

不同工具的阶段名：`VideoZoom` / `VideoMark` 用 `Config`、`RenderConfirm`；`VideoSpeedPart` / `VideoKeepPart` 用 `Config`；`VideoQuickCut` 用 `Confirm`。

## 认证配置

CLI 工具通过读取本地配置文件与 AIGCPanel 服务通信，配置文件在启动 AIGCPanel 后自动生成：

- **macOS**: `~/Library/Application Support/aigcpanel/cli-auth.json`
- **Linux**: `${XDG_CONFIG_HOME:-~/.config}/aigcpanel/cli-auth.json`
- **Windows**: `%APPDATA%\aigcpanel\cli-auth.json`

如果软件通过 `AIGCPANEL_DATA_ROOT` 重定向了数据目录，CLI 也会从同一目录读取 `cli-auth.json`。

配置文件只包含本机接口端口和访问 Token，CLI 会自动携带，不需要手动配置。
