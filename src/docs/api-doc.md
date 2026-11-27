# API 服务文档

AIGCPanel 内置了 HTTP 接口服务，支持通过 HTTP 协议远程调用模型服务、内置工具和工作流，方便集成到第三方系统或自动化流程中。

---

## 服务地址

API 服务默认监听 `127.0.0.1`（仅本机可访问）。在「设置 - API 服务」中开启「局域网访问」后，同一局域网内的设备也可通过本机局域网 IP 访问；开启后设置页会显示局域网服务地址与端口。下文用 `http://127.0.0.1:端口` 表示。

---

## 认证方式

除 `/doc` 外，所有接口都需要携带访问 Token，二选一：

```
Authorization: Bearer <你的Token>
```

```
Api-Token: <你的Token>
```

`X-Api-Token` 也可以。Token 在「设置 - API 服务 - 访问 Token」中配置，CLI 工具会自动读取，无需手动配置。

---

## 接口列表

### 模型管理

#### POST /api/model/list

获取已安装的模型服务精简列表。

**请求体：** 无参数，传空 JSON `{}` 即可

**返回示例：**

```json
{
  "code": 0,
  "data": [
    {
      "id": "aigcpanel-server-tts|1.0.0",
      "name": "aigcpanel-server-tts",
      "version": "1.0.0",
      "title": "语音合成",
      "type": "local",
      "description": "文本转语音",
      "functions": [
        {
          "name": "soundTts",
          "args": ["text"],
          "param": []
        }
      ],
      "settings": [],
      "config": {
        "type": "local",
        "entry": "",
        "description": "文本转语音",
        "deviceDescription": "",
        "minDisk": "",
        "minMemory": "",
        "minGpu": "",
        "minGpuMemory": ""
      }
    }
  ]
}
```

#### POST /api/model/info

获取指定模型的完整参数信息（含字段定义、设置项、硬件要求）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型标识，格式 `name\|version` 或仅 `name` |

**返回字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 模型唯一标识 `name\|version` |
| name | string | 模型名称 |
| version | string | 模型版本 |
| title | string | 模型显示名称 |
| description | string | 模型功能描述 |
| type | string | 模型类型（local / localDir / remote / cloud / comfyui） |
| requirements | object | 硬件要求（minDisk / minMemory / minGpu / minGpuMemory / deviceDescription） |
| functions | array | 功能列表，每项含 name / title / description / args / param（含详细字段定义）/ result |
| settings | array | 模型设置项列表（GPU选择、超时等） |
| config | object | config.json 精简信息（entry / assetName / autoStart） |

**返回示例：**

```json
{
  "code": 0,
  "data": {
    "id": "aigcpanel-server-tts|1.0.0",
    "name": "aigcpanel-server-tts",
    "version": "1.0.0",
    "title": "语音合成",
    "description": "文本转语音",
    "type": "local",
    "requirements": {
      "minDisk": "1GB",
      "minMemory": "2GB",
      "minGpu": "",
      "minGpuMemory": "",
      "deviceDescription": ""
    },
    "functions": [
      {
        "name": "soundTts",
        "title": "语音合成",
        "description": "将文本合成为自然语音",
        "args": ["text"],
        "param": [
          {
            "name": "speaker",
            "title": "发音人",
            "type": "select",
            "default": "default",
            "required": false,
            "options": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"]
          }
        ],
        "result": [
          {
            "name": "url",
            "title": "音频文件路径",
            "type": "string",
            "description": "生成的音频文件路径"
          }
        ]
      }
    ],
    "settings": [
      { "name": "gpu", "title": "GPU选择", "type": "gpuSelector", "default": "" }
    ],
    "config": { "entry": "", "assetName": "", "autoStart": true }
  }
}
```

---

### 模型调用

#### POST /api/server/list

获取已安装模型的服务列表，字段与 `/api/model/list` 类似（`id`、`name`、`version`、`title`、`functions`）。

**请求体：** 无参数，传空 JSON `{}` 即可

#### POST /api/server/call

调用模型能力，异步返回 `taskId`。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型标识，格式 `name\|version`，version 可省略 |
| function | string | 能力名：`soundTts`、`soundClone`、`videoGen`、`asr`、`textToImage`、`imageToImage`、`textToVideo`、`imageToVideo`、`comfyui`、`general` |
| param | object | 能力参数。除 `param` 子对象的动态参数外，还需要能力自身字段，如 TTS 的 `text` |
| env | object | 可选，额外的 `AIGCPANEL_*` 环境变量 |

**请求示例（语音合成）：**

```json
{
  "server": "aigcpanel-server-tts|1.0.0",
  "function": "soundTts",
  "param": {
    "text": "你好，欢迎使用 AIGCPanel",
    "param": { "speaker": "zh-CN-XiaoxiaoNeural" }
  }
}
```

**请求示例（ComfyUI 工作流）：**

```json
{
  "server": "server-ComfyUI",
  "function": "comfyui",
  "param": {
    "comfyuiName": "textToImageFlux",
    "param": { "width": 512, "height": 512 }
  }
}
```

**请求示例（通用模型）：**

```json
{
  "server": "server-demo",
  "function": "general",
  "param": {
    "generalName": "generalImage",
    "param": { "prompt": "一只猫", "count": 2 }
  }
}
```

**返回示例：**

```json
{
  "code": 0,
  "data": { "taskId": "123" }
}
```

#### POST /api/server/query

查询任务结果，支持长轮询（最多约 60 秒，超时返回 `pending`）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| taskId | string | 由 `/api/server/call` 或 `/api/tools/submit` 返回的任务 ID |

**返回示例（处理中）：**

```json
{ "code": 0, "data": { "status": "pending" } }
```

**返回示例（成功）：**

```json
{
  "code": 0,
  "data": {
    "status": "success",
    "result": {
      "code": 0,
      "msg": "ok",
      "data": {
        "type": "success",
        "start": 1714300000000,
        "end": 1714300005000,
        "data": { "url": "/path/to/output.wav" }
      }
    }
  }
}
```

**返回示例（失败）：**

```json
{ "code": 0, "data": { "status": "error", "error": "错误原因" } }
```

**返回示例（暂停，等待人工确认）：**

```json
{
  "code": 0,
  "data": {
    "status": "pause",
    "taskId": "123",
    "step": "Config",
    "statusMsg": "任务未完成，需要手动确认"
  }
}
```

#### POST /api/server/log

查看模型服务日志（取该模型最新一个日志文件，最多返回末尾 512KB）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型服务标识，支持 `name\|version` 或仅 `name` |

**返回示例：**

```json
{
  "code": 0,
  "data": {
    "file": "server-ComfyUI_1.0.0_20260814.log",
    "content": "[I] 2026-08-14 ..."
  }
}
```

没有日志时返回 `{ "file": null, "content": "" }`。

#### POST /api/server/setting

设置模型服务参数（gpu / idleTimeout 等），合并到已有设置。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型服务标识，支持 `name\|version` 或仅 `name` |
| setting | object | 要合并的设置对象 |

**返回：** 合并后的完整 `setting` 对象。

#### POST /api/server/workflows

获取 ComfyUI 模型的工作流列表（仅 VIP 用户返回内容）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型服务标识，仅 ComfyUI 类型模型有效 |

非 VIP 返回：

```json
{ "code": 0, "data": { "vip": false, "workflows": [] } }
```

VIP 返回的每项工作流包含 `key`、`title`、`description`、`param`、`biz`、`hasUserConfig`。

---

### 模型安装与权重

#### POST /api/server/install

从本地目录安装模型服务。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| path | string | 模型服务目录的绝对路径，需包含 config.json。同名同版本自动覆盖（upsert）。 |

**返回：** 安装后的模型记录。

#### POST /api/server/remove

卸载已安装的模型服务（会先停止运行中的进程）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型服务标识，支持 `name\|version` 或仅 `name` |
| force | boolean | 可选；权重下载中默认拒绝删除，`true` 强制删除 |

**返回示例：**

```json
{ "code": 0, "data": { "removed": 1 } }
```

#### POST /api/server/prepare

确保模型权重就绪（`config.json` 未声明 `prepare` 的模型直接返回就绪状态）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型服务标识，支持 `name\|version` 或仅 `name` |
| wait | boolean | 可选，默认 `true` 等待下载完成；`false` 只返回当前状态 |

#### POST /api/server/preparePause

暂停权重下载，保留已下载文件，稍后可续传。`/api/server/prepareCancel` 是兼容别名。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型服务标识，支持 `name\|version` 或仅 `name` |

**返回示例：**

```json
{ "code": 0, "data": { "paused": true, "cancelled": true } }
```

---

### 文件上传与下载

#### POST /api/upload

上传文件到临时目录，支持两种方式二选一。

**方式一：multipart/form-data**

| 字段 | 类型 | 说明 |
|------|------|------|
| file | file | 上传的文件 |

**方式二：JSON**

| 字段 | 类型 | 说明 |
|------|------|------|
| fileBase64 | string | `data:<mime>;base64,<数据>` 或纯 base64 |
| name | string | 可选，保存的文件名；不传自动生成 |

**返回示例：**

```json
{
  "code": 0,
  "data": {
    "path": "/path/to/uploads/1714300000_ab12cd34ef56.png",
    "name": "1714300000_ab12cd34ef56.png",
    "size": 102400,
    "mime": "image/png"
  }
}
```

#### POST /api/file/download

下载模型产出的结果文件（如生成的图片 / 音频 / 视频）。仅允许访问数据目录与已安装模型目录下的文件。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| path | string | 结果文件的绝对路径（模型返回的 `url` / `path` 字段） |

**返回：** 文件二进制流（`Content-Type` 按扩展名推断）。

**示例：**

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"path":"/path/to/result.png"}' \
  http://127.0.0.1:端口/api/file/download -o result.png
```

---

### 工具调用

#### POST /api/tools/submit

提交一个内置工具任务。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| biz | string | 工具类型，如 `VideoCompress`、`Ffmpeg`（必填） |
| modelConfig | object | 工具参数对象（也可传 JSON 字符串，接口会原样存入） |
| param | object | 可选，任务参数 |
| title | string | 可选，任务标题；默认 `biz + "-task"` |
| env | object | 可选，额外的 `AIGCPANEL_*` 环境变量 |

**返回示例：**

```json
{ "code": 0, "data": { "taskId": "123" } }
```

#### POST /api/tools/continue

继续一个暂停的工具任务（人工确认阶段）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| taskId | string | 暂停的任务 ID（必填） |
| stage | string | 当前阶段名（必填） |
| data | object | 该阶段要写入的数据 |
| env | object | 可选，额外的环境变量 |

支持继续的工具与阶段：`VideoZoom` / `VideoMark`（`Config`、`RenderConfirm`）、`VideoSpeedPart` / `VideoKeepPart`（`Config`）、`VideoQuickCut`（`Confirm`）。

**返回示例：**

```json
{ "code": 0, "data": { "taskId": "123" } }
```

---

### 工作流

#### POST /api/workflow/list

获取工作流列表。

**请求体：** 无参数

**返回示例：**

```json
{ "code": 0, "data": { "list": [{ "id": 1, "name": "我的流程", "createdAt": 1714300000, "updatedAt": 1714300000 }] } }
```

#### POST /api/workflow/run

提交一段工作流数据执行（会创建一个 `_test_` 开头的临时工作流）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| data | object | 工作流数据，必须包含 `nodes` 数组 |

**返回示例：**

```json
{ "code": 0, "data": { "workflowLogId": "1", "workflowId": "1" } }
```

#### POST /api/workflow/run-named

按名称运行已保存的工作流（同名取最新一个）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 工作流名称 |

**返回：** 同上，返回 `workflowLogId` 与 `workflowId`。

#### POST /api/workflow/query

查询工作流运行结果，支持长轮询（最多约 10 秒，超时返回 `pending`）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| workflowLogId | string | 运行返回的日志 ID |

**返回示例：**

```json
{
  "code": 0,
  "data": { "status": "success", "statusMsg": "", "logData": { "nodes": [], "edges": [] } }
}
```

#### POST /api/workflow/cleanup-test

清理测试工作流（名称以 `_test_` 开头或为「新建工作流」）及其运行日志。

**请求体：** 无参数

**返回示例：**

```json
{ "code": 0, "data": { "deleted": 3 } }
```

---

### 直播

#### POST /api/live/tts

使用直播音色把文本合成为音频，返回音频的本地绝对路径。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| voiceId | string/number | 直播音色 ID（必填） |
| text | string | 要合成的文本（必填） |

**返回示例：**

```json
{ "code": 0, "data": { "url": "/path/to/output.wav" } }
```

音色不存在返回 404 `VoiceNotFound`。

---

### 文档

#### GET /doc

API 文档页面（无需认证）。默认中文，`?lang=en` 或 `Accept-Language: en` 返回英文版。

---

## 调用示例

### 查看已安装模型列表

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:端口/api/model/list
```

### 查看模型参数信息

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"server":"aigcpanel-server-tts|1.0.0"}' \
  http://127.0.0.1:端口/api/model/info
```

### 调用语音合成

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"server":"aigcpanel-server-tts|1.0.0","function":"soundTts","param":{"text":"你好"}}' \
  http://127.0.0.1:端口/api/server/call
```

### 查询任务结果

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"123"}' \
  http://127.0.0.1:端口/api/server/query
```

### 上传文件（multipart）

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -F "file=@/path/to/audio.wav" \
  http://127.0.0.1:端口/api/upload
```

### 上传文件（Base64 JSON）

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"fileBase64":"data:audio/wav;base64,//uQxAAA..."}' \
  http://127.0.0.1:端口/api/upload
```

### 下载结果文件

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"path":"/path/to/result.png"}' \
  http://127.0.0.1:端口/api/file/download -o result.png
```
