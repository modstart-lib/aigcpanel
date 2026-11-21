---
name: aigcpanel-cli-skill
description: 通过 AIGCPanel 内置 HTTP 接口或命令行 CLI 工具调用本地 AI 模型和任务处理能力。当需要列出可用模型、安装/删除模型、调用模型生成内容、查询任务结果、查看模型日志、设置模型参数、查看 ComfyUI 工作流、或批量处理视频/音频/图片时使用本技能。适用场景：自动化脚本调用 AI 模型、外部程序集成 AIGCPanel、批量处理任务、CLI 命令行调用。
---

# AIGCPanel 集成指南

AIGCPanel 提供两种集成方式：**HTTP 接口**（适合外部程序集成）和 **CLI 命令行工具**（适合脚本和终端操作）。

---

## 一、CLI 命令行工具

CLI 工具 `aigcpanel` 提供简洁的命令行接口，适合在脚本和终端中使用。命令名统一使用**小写驼峰**（如 `serverCall`、`serverList`），参数名统一使用**小写驼峰**（如 `--comfyuiName`、`--taskId`）。

### 安装

打开应用 **设置 → CLI 工具**，点击"安装到系统"，即可在终端使用 `aigcpanel` 命令。构建 CLI 使用 `make build-cli`（产物在 `dist-cli/`）。

### 命令概览

| 命令 | 说明 |
|------|------|
| `aigcpanel version` | 查看版本信息 |
| `aigcpanel serverInstall --dir <路径>` | 安装本地模型服务（目录需含 config.json） |
| `aigcpanel serverRemove --server <name\|version>` | 删除已安装模型服务（自动停止运行中的服务） |
| `aigcpanel serverList` | 列出所有已安装 AI 模型服务 |
| `aigcpanel serverComfyuiList --server <name\|version>` | 列出 ComfyUI 服务的工作流（仅 VIP 用户） |
| `aigcpanel serverCall --server <name\|version> --function <func> [参数...]` | 调用模型服务功能并等待结果 |
| `aigcpanel serverLog --server <name\|version>` | 查看模型服务日志 |
| `aigcpanel serverSetting --server <name\|version> --<key> <value>...` | 设置模型参数（如 gpu / idleTimeout） |
| `aigcpanel tools --name <类型> --param '<json>'` | 调用内置工具并等待结果 |

> **`--server` 版本号规则**：以上命令的 `--server` 均可省略版本号（只传名称）。省略时按名称匹配已安装服务：匹配到唯一版本则直接执行；匹配到多个版本则报错，需补传版本号（`name|version`）。

> 命令名统一使用小写驼峰（如 `serverInstall` / `serverList` / `serverCall`），不提供中划线或下划线别名。

### 列出模型服务

```bash
aigcpanel serverList
```

输出示例：
```json
{
  "code": 0,
  "data": [
    { "name": "server-ComfyUI", "title": "通用 ComfyUI", "version": "1.0.0", "functions": [...] }
  ]
}
```

ComfyUI 服务会额外显示 `comfyui` 功能，表示可通过 `serverCall --function comfyui` 调用其工作流。

### 安装 / 删除模型

```bash
# 安装本地模型服务（目录含 config.json）
aigcpanel serverInstall --dir /path/to/model-server-dir

# 删除模型服务（自动停止运行中的服务，--server 可省略版本号）
aigcpanel serverRemove --server server-ComfyUI
```

### 调用模型服务服务（serverCall）

```bash
aigcpanel serverCall --server <name|version> --function <func> [--key value ...]
```

- `--server`：服务器标识，格式 `name|version`，**可省略版本号**
- `--function`：功能名（soundTts / soundClone / videoGen / asr / textToImage / imageToImage / textToVideo / imageToVideo / comfyui / general）
- `--comfyuiName`：`--function comfyui` 时选择 ComfyUI 工作流（如 textToImageFlux）
- `--generalName`：`--function general` 时选择通用模型能力（如 generalImage）
- `--timeout`：轮询超时（秒，默认 600）
- 复杂参数用 JSON 传递：`--param '{"...":...}'`（作为 function 内部参数，与扁平 `--key value` 同时生效；也可用 `--keyJson /path/to/file.json` 从文件读取）

> **`--server` 版本号规则**：所有带 `--server` 参数的命令均可省略版本号。只传名称时按名称匹配已安装服务——若只有一个匹配则直接执行；若匹配到多个版本则报错，提示必须传递版本号（格式 `name|version`）。

```bash
# 语音合成（仅名称，自动匹配唯一版本）
aigcpanel serverCall --server server-demo --function soundTts --text "你好世界"

# 语音合成（名称+版本，明确指定）
aigcpanel serverCall --server server-demo|1.1.0 --function soundTts --text "你好世界"

# 语音识别
aigcpanel serverCall --server server-demo|1.1.0 --function asr --audio /path/to/a.wav

# 文生图
aigcpanel serverCall --server server-demo|1.1.0 --function textToImage --prompt "美丽的山水风景" --param '{"width":512,"height":512}'
```

#### 调用 ComfyUI 工作流

```bash
# --function comfyui 调用 ComfyUI 工作流：--comfyuiName 扁平选择工作流，
# 其余参数通过 --param JSON 传递
aigcpanel serverCall --server server-ComfyUI|1.0.0 --function comfyui \
  --comfyuiName demo1 --param '{"width":512,"height":512,"color":"红色"}'

# 复杂参数也可用文件
aigcpanel serverCall --server server-ComfyUI|1.0.0 --function comfyui \
  --comfyuiName demo1 --paramJson ./_temp/param.json
```

ComfyUI 服务为自启动模式：调用时自动拉起，任务完成后空闲自动退出（空闲时间可在模型设置中配置，默认 60 秒）。

### 查看服务日志 / 设置服务参数

```bash
# 查看最新模型日志
aigcpanel serverLog --server server-ComfyUI|1.0.0

# 设置模型参数（参数名小写驼峰，与服务端字段一致）
aigcpanel serverSetting --server server-ComfyUI|1.0.0 --gpu 0 --idleTimeout 120

# 复杂参数用 JSON 文件
aigcpanel serverSetting --server server-ComfyUI|1.0.0 --settingJson ./_temp/setting.json
```

> 注意：模型参数修改后需重新启动服务生效。

### 查看 ComfyUI 服务工作流（VIP）

```bash
# 列出指定 ComfyUI 服务的工作流（仅 VIP 用户；非 VIP 返回空列表）
aigcpanel serverComfyuiList --server server-ComfyUI|1.0.0

# 完整输出（含参数定义 param）
aigcpanel serverComfyuiList --server server-ComfyUI|1.0.0 --json
```

### 调用工具（tools）

工具参数统一通过 `--param` 传入一个 JSON 字符串（不再扁平化），只保留 `--name`（工具类型）、`--taskId`、`--stage` 三个扁平参数：

```bash
# 语音合成
aigcpanel tools --name SoundGenerate --param '{"text":"你好世界"}'

# 数字人合成（视频生成）
aigcpanel tools --name VideoGen --param '{"text":"欢迎使用"}'

# 一键合成（视频生成流）
aigcpanel tools --name VideoGenFlow --param '{"text":"欢迎使用"}'

# 语音识别
aigcpanel tools --name SoundAsr --param '{"file":"/path/to/audio.wav"}'

# 声音替换
aigcpanel tools --name SoundReplace --param '{"file":"/path/to/video.mp4"}'

# 长文本转音频
aigcpanel tools --name LongTextTts --param '{"text":"这是一段较长的文本内容"}'

# 字幕转音频
aigcpanel tools --name SubtitleTts --param '{"file":"/path/to/subtitle.srt"}'

# 文生图
aigcpanel tools --name TextToImage --param '{"prompt":"美丽的山水风景"}'

# 图生图
aigcpanel tools --name ImageToImage --param '{"file":"/path/to/image.png","prompt":"油画风格"}'

# 声音归一化
aigcpanel tools --name AudioNormal --param '{"file":"/path/to/audio.wav"}'

# 视频压缩
aigcpanel tools --name VideoCompress --param '{"file":"/path/to/video.mp4"}'

# 视频尺寸转换
aigcpanel tools --name VideoSizeConvert --param '{"file":"/path/to/video.mp4","targetWidth":1280,"targetHeight":720}'

# 视频变速（全局）
aigcpanel tools --name VideoSpeed --param '{"file":"/path/to/video.mp4","speed":1.5}'

# 视频片段变速
aigcpanel tools --name VideoSpeedPart --param '{"file":"/path/to/video.mp4"}'

# 视频背景替换
aigcpanel tools --name VideoBackground --param '{"file":"/path/to/video.mp4","image":"/path/to/bg.png"}'

# 更换视频背景（绿幕抠像）
aigcpanel tools --name VideoBackgroundReplace --param '{"video":"/path/to/green.mp4","image":"/path/to/bg.png","keyColor":"#00FF00","similarity":0.3,"blend":0.1}'

# 视频合并
aigcpanel tools --name VideoMerge --param '{"file":"/path/to/video1.mp4","file2":"/path/to/video2.mp4"}'

# 视频添加音频
aigcpanel tools --name VideoMergeAudio --param '{"file":"/path/to/video.mp4","audio":"/path/to/audio.wav"}'

# 片头片尾图片
aigcpanel tools --name VideoMergeImage --param '{"file":"/path/to/video.mp4","image":"/path/to/image.png"}'

# 视频添加字幕
aigcpanel tools --name VideoSubtitle --param '{"file":"/path/to/video.mp4","subtitle":"/path/to/subtitle.srt"}'

# 视频标注
aigcpanel tools --name VideoMark --param '{"file":"/path/to/video.mp4"}'

# 视频片段删除/保留
aigcpanel tools --name VideoKeepPart --param '{"file":"/path/to/video.mp4"}'

# 视频片段放大
aigcpanel tools --name VideoZoom --param '{"file":"/path/to/video.mp4"}'

# 智能剪辑
aigcpanel tools --name VideoQuickCut --param '{"file":"/path/to/video.mp4"}'

# 媒体格式转换
aigcpanel tools --name MediaFormatConvert --param '{"file":"/path/to/video.mp4","targetFormat":"mp4"}'

# Ffmpeg 自定义处理
aigcpanel tools --name Ffmpeg --param '{"file1":"/path/to/input.mp4"}'

# 通用 ComfyUI 工作流
aigcpanel tools --name GeneralComfyUI --param '{"comfyuiName":"demo1","width":512,"height":512}'
```

数组/对象类型参数直接写在 `--param` JSON 中即可：

```bash
# VideoZoom 指定放大区域（times 为数组）
aigcpanel tools --name VideoZoom --param '{"file":"/path/to/video.mp4","times":[{"start":1.0,"end":3.0,"x":0.2,"y":0.1,"width":0.6,"height":0.8}]}'
```

### 继续暂停的任务

部分任务（如 VideoZoom、VideoMark）需要确认才能继续执行：

```bash
# 第一步：提交任务（返回 taskId 和 pauseStage）
aigcpanel tools --name VideoZoom --param '{"file":"/path/to/video.mp4"}'

# 第二步：确认继续（Config 阶段，数据通过 --param 传入）
aigcpanel tools --name VideoZoom --taskId <taskId> --stage Config --param '{"times":[{"startMs":0,"endMs":3000,"x":0,"y":0,"width":640,"height":480}]}'

# 第三步：渲染确认（RenderConfirm 阶段，如有）
aigcpanel tools --name VideoZoom --taskId <taskId> --stage RenderConfirm
```

### 输出结果

任务成功时输出包含 `result` 字段，通常有 `url`（输出文件路径）：

```json
{
  "code": 0,
  "data": {
    "status": "success",
    "result": { "url": "/path/to/output.mp4" }
  }
}
```

---

## 二、HTTP 接口

AIGCPanel 内置 HTTP 接口服务（端口见 `cli-auth.json`，位于应用 userData 目录），提供模型列表、模型调用、模型管理、任务结果查询能力。所有接口需在请求头携带 `Authorization: Bearer <token>`（token 同样来自 `cli-auth.json`）。

### 获取可用模型服务

```
GET /api/server/list
```

响应示例：
```json
{
  "code": 0,
  "data": [
    { "id": "server-ComfyUI|1.0.0", "name": "server-ComfyUI", "title": "通用 ComfyUI", "version": "1.0.0", "functions": [...] }
  ]
}
```

`id` 格式为 `name|version`，调用时需传此值。

### 调用模型服务

```
POST /api/server/call
Content-Type: application/json

{ "server": "server-ComfyUI|1.0.0", "function": "comfyui", "comfyuiName": "demo1", "param": { "width": 512, "height": 512 } }
```

- `server`（必填）：服务器标识，格式 `name|version`，**可省略版本号**（省略时按名称匹配，唯一则调用，多个版本则报错要求传版本号）
- `function`（必填）：功能名（soundTts / soundClone / videoGen / asr / textToImage / imageToImage / textToVideo / imageToVideo / comfyui）
- 其余字段按功能传入（如 `prompt`、`text`、`audio`、`comfyuiName`、`param` 等）

响应：
```json
{ "code": 0, "data": { "taskId": "123" } }
```

### 查询任务结果

```
POST /api/server/query
Content-Type: application/json

{ "taskId": "123" }
```

响应（进行中）：`{ "code": 0, "data": { "status": "pending" } }`
响应（成功）：`{ "code": 0, "data": { "status": "success", "result": { "code": 0, "data": { "data": { "url": "/path/to/output.png" } } } } }`
响应（失败）：`{ "code": 0, "data": { "status": "error", "error": "..." } }`

`status` 为 `pending` 时继续轮询，建议间隔 500ms。

### 模型管理接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/server/install` | POST | 安装本地模型（body: `{ "path": "/abs/path" }`） |
| `/api/server/remove` | POST | 删除模型（body: `{ "name", "version" }`，自动停止服务） |
| `/api/server/log?server=` | GET | 查看模型日志 |
| `/api/server/setting` | POST | 设置模型参数（body: `{ "server", "setting": {...} }`） |
| `/api/server/workflows?server=` | GET | 获取 ComfyUI 工作流列表（仅 VIP 用户） |

### 标准调用流程

1. 调用 `/api/server/list` 获取可用模型服务列表，选取目标服务 `id`
2. 调用 `/api/server/call` 传入 `server` 和 `function`（及对应参数），获得 `taskId`
3. 轮询 `/api/server/query` 直至 `status` 不为 `pending`
4. 读取 `result`（成功）或 `error`（失败）

## 错误处理

所有接口错误时返回 `{ "code": -1, "msg": "错误描述" }`，`code` 非 0 时视为失败。
常见原因：服务未启动、模型未安装、ComfyUI 工作流不存在、非 VIP 用户访问工作流列表。
