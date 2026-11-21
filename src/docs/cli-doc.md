# CLI 工具文档

AIGCPanel CLI 是一个命令行工具，可通过终端直接调用模型服务和内置工具，适用于自动化脚本和 CI/CD 集成。

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
右键"此电脑" → 属性 → 高级系统设置 → 环境变量 → 在 Path 中添加上方目录路径

---

## 命令列表

| 命令 | 说明 |
|------|------|
| `version` | 查看 CLI 版本号 |
| `serverList` | 列出已安装的 AI 模型 |
| `serverInstall` | 从本地目录安装模型 |
| `serverRemove` | 卸载已安装的模型 |
| `serverCall` | 调用模型功能 |
| `serverSetting` | 设置模型参数 |
| `serverLog` | 查看模型日志 |
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

### 调用工具

```bash
aigcpanel tools --name <工具类型> --param '{"参数名":"值",...}'
```

**参数说明：**

| 参数 | 说明 |
|------|------|
| `--name` | 必填，工具类型名称 |
| `--param` | 工具参数 JSON 字符串，作为 modelConfig 传入 |
| `--taskId` / `--stage` | 继续暂停的任务时使用 |

---

## 工具列表

### 语音合成

```bash
aigcpanel tools --name SoundGenerate --param '{"text":"你好世界"}'
```

### 语音识别

```bash
aigcpanel tools --name SoundAsr --param '{"file":"/path/to/audio.wav"}'
```

### 数字人合成

```bash
aigcpanel tools --name VideoGen --param '{"text":"欢迎使用"}'
```

### 视频生成流

```bash
aigcpanel tools --name VideoGenFlow --param '{"text":"欢迎使用"}'
```

### 长文本转音频

```bash
aigcpanel tools --name LongTextTts --param '{"text":"这是一段较长的文本内容"}'
```

### 字幕转音频

```bash
aigcpanel tools --name SubtitleTts --param '{"file":"/path/to/subtitle.srt"}'
```

### 声音替换

```bash
aigcpanel tools --name SoundReplace --param '{"file":"/path/to/video.mp4"}'
```

### 文生图

```bash
aigcpanel tools --name TextToImage --param '{"prompt":"美丽的山水风景"}'
```

### 图生图

```bash
aigcpanel tools --name ImageToImage --param '{"file":"/path/to/image.png","prompt":"油画风格"}'
```

### 声音归一化

```bash
aigcpanel tools --name AudioNormal --param '{"file":"/path/to/audio.wav"}'
```

### Ffmpeg 处理

```bash
aigcpanel tools --name Ffmpeg --param '{"file":"/path/to/input.mp4"}'
```

### 媒体格式转换

```bash
aigcpanel tools --name MediaFormatConvert --param '{"file":"/path/to/video.mp4","targetFormat":"mp4"}'
```

### 视频背景

```bash
aigcpanel tools --name VideoBackground --param '{"file":"/path/to/video.mp4","image":"/path/to/bg.png"}'
```

### 更换视频背景

```bash
aigcpanel tools --name VideoBackgroundReplace --param '{"video":"/path/to/green.mp4","image":"/path/to/bg.png","keyColor":"#00FF00","similarity":0.3,"blend":0.1}'
```

### 视频压缩

```bash
aigcpanel tools --name VideoCompress --param '{"file":"/path/to/video.mp4"}'
```

### 视频片段删除/保留

```bash
aigcpanel tools --name VideoKeepPart --param '{"file":"/path/to/video.mp4"}'
```

### 视频标注

```bash
aigcpanel tools --name VideoMark --param '{"file":"/path/to/video.mp4"}'
```

### 视频合并

```bash
aigcpanel tools --name VideoMerge --param '{"file":"/path/to/video1.mp4","file2":"/path/to/video2.mp4"}'
```

### 视频添加音频

```bash
aigcpanel tools --name VideoMergeAudio --param '{"file":"/path/to/video.mp4","audio":"/path/to/audio.wav"}'
```

### 片头片尾图片

```bash
aigcpanel tools --name VideoMergeImage --param '{"file":"/path/to/video.mp4","image":"/path/to/image.png"}'
```

### 快速剪辑

```bash
aigcpanel tools --name VideoQuickCut --param '{"file":"/path/to/video.mp4"}'
```

### 视频尺寸转换

```bash
aigcpanel tools --name VideoSizeConvert --param '{"file":"/path/to/video.mp4","targetWidth":1280,"targetHeight":720}'
```

### 视频变速

```bash
aigcpanel tools --name VideoSpeed --param '{"file":"/path/to/video.mp4","speed":1.5}'
```

### 视频片段变速

```bash
aigcpanel tools --name VideoSpeedPart --param '{"file":"/path/to/video.mp4"}'
```

### 视频添加字幕

```bash
aigcpanel tools --name VideoSubtitle --param '{"file":"/path/to/video.mp4","subtitle":"/path/to/subtitle.srt"}'
```

### 视频片段放大

```bash
aigcpanel tools --name VideoZoom --param '{"file":"/path/to/video.mp4"}'
```

---

## 认证配置

CLI 工具通过读取本地配置文件与 AIGCPanel 服务通信，配置文件在启动 AIGCPanel 后自动生成：

- **macOS**: `~/Library/Application Support/aigcpanel/cli-auth.json`
- **Linux**: `~/.config/aigcpanel/cli-auth.json`
- **Windows**: `%APPDATA%\aigcpanel\cli-auth.json`