# API 服务文档

AIGCPanel 内置了 HTTP 接口服务，支持通过 HTTP 协议远程调用模型服务和工具，方便集成到第三方系统或自动化流程中。

---

## 服务地址

API 服务始终监听 `127.0.0.1`（仅本机可访问）。在「设置 - API 服务」中开启「局域网访问」后，同一局域网内的设备也可通过本机局域网 IP 访问；开启后设置页会显示局域网服务地址与端口。

---

## 认证方式

所有接口（除 `/doc` 外）均需在请求头中携带 `Authorization` 进行 Bearer Token 认证：

```
Authorization: Bearer <你的Token>
```

Token 在「设置 - API 服务 - 访问 Token」中配置。CLI 工具会自动读取该 Token，无需手动配置。

---

## 接口列表

### 模型管理

#### POST /api/model/list

获取已安装的模型服务列表。

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
      "functions": [
        {
          "name": "soundTts",
          "args": ["text"],
          "param": [...]
        }
      ]
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
| type | string | 模型类型（local / remote / cloud / comfyui） |
| requirements | object | 硬件要求（minDisk / minMemory / minGpu / minGpuMemory / deviceDescription） |
| functions | array | 功能列表，每项含 name / title / description / args / param（含详细字段定义）/ result |
| settings | array | 模型设置项列表（GPU选择、超时等） |

**返回示例：**

```json
{
  "code": 0,
  "data": {
    "id": "aigcpanel-server-tts|1.0.0",
    "name": "aigcpanel-server-tts",
    "version": "1.0.0",
    "title": "语音合成",
    "description": "文本转语音服务",
    "type": "local",
    "requirements": {
      "minDisk": "1GB",
      "minMemory": "2GB",
      "minGpu": "",
      "minGpuMemory": ""
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
    ]
  }
}
```

#### POST /api/model/call

调用模型服务功能，异步返回 taskId。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| model | string | 服务标识，格式 `name\|version`，version 可省略 |
| function | string | 调用的功能名称 |
| param | object | 功能参数对象 |
| param.param | object | 动态参数对象 |

**请求示例（语音合成）：**

```json
{
  "model": "aigcpanel-server-tts|1.0.0",
  "function": "soundTts",
  "param": {
    "text": "你好，欢迎使用 AIGCPanel",
    "param": { "speaker": "zh-CN-XiaoxiaoNeural" }
  }
}
```

**返回示例：**

```json
{
  "code": 0,
  "data": { "taskId": "lz3k8m2abc1" }
}
```

#### POST /api/model/query

查询任务结果，支持长轮询（最多 60 秒）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| taskId | string | 由 /api/model/call 返回的任务 ID |

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
      "type": "success",
      "start": 1714300000000,
      "end": 1714300005000,
      "data": { "url": "/path/to/output.wav" }
    }
  }
}
```

#### POST /api/model/log

查看模型服务日志。

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

#### POST /api/model/setting

设置模型服务参数（gpu / idleTimeout 等）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型服务标识，支持 `name\|version` 或仅 `name` |
| setting | object | 要设置的参数对象（合并到已有设置，重启服务后生效） |

#### POST /api/model/workflows

获取 ComfyUI 模型的工作流列表（仅 VIP 用户）。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型服务标识，仅 ComfyUI 类型模型有效 |

---

### 服务器管理

#### POST /api/server/list

获取服务器列表。与 /api/model/list 相同。

#### POST /api/server/install

从本地目录安装模型服务。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| path | string | 模型服务目录的绝对路径，需包含 config.json。同名同版本已存在时自动覆盖（upsert）。 |

#### POST /api/server/remove

卸载已安装的模型服务。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| server | string | 模型服务标识，支持 `name\|version` 或仅 `name` |

#### POST /api/server/log

查看模型服务日志。与 /api/model/log 相同。

#### POST /api/server/setting

设置模型服务参数。与 /api/model/setting 相同。

#### POST /api/server/workflows

获取 ComfyUI 模型工作流列表。与 /api/model/workflows 相同。

---

### 文件上传

#### POST /api/upload

上传文件到临时目录，支持两种方式二选一。

**方式一：multipart/form-data**

| 字段 | 类型 | 说明 |
|------|------|------|
| file | file | 要上传的文件，字段名为 `file`，支持任意格式，最大 2GB |

**方式二：JSON body**

| 字段 | 类型 | 说明 |
|------|------|------|
| fileBase64 | string | Base64 编码的文件内容，支持 `data:image/png;base64,xxxx` 格式或纯 Base64 字符串 |
| name | string | 文件名，不传则自动生成 |

**返回示例：**

```json
{
  "code": 0,
  "data": {
    "path": "/path/to/userData/data/temp/uploads/xxx.wav",
    "name": "original-file.wav",
    "size": 1024000,
    "mime": "audio/wav"
  }
}
```

上传的文件会保存到临时目录，返回的 `path` 可在后续调用 `/api/model/call` 时作为 `param.audio`、`param.video`、`param.image` 等文件参数使用。文件会定期自动清理。

---

### 工具调用

#### POST /api/tools/submit

提交工具任务。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| biz | string | 工具类型，如 SoundGenerate、VideoGen、VideoCompress 等 |
| param | object | 工具参数 |
| modelConfig | object | 模型配置 |
| title | string | 任务标题（可选） |
| env | object | 环境变量（可选） |

#### POST /api/tools/continue

继续暂停的任务。

**请求体：**

| 字段 | 类型 | 说明 |
|------|------|------|
| taskId | string | 任务 ID |
| stage | string | 当前阶段 |
| data | object | 阶段数据 |
| env | object | 环境变量（可选） |

---

### 工作流

#### POST /api/workflow/list

获取工作流列表。

#### POST /api/workflow/run

运行工作流。

#### POST /api/workflow/query

查询工作流状态。

#### POST /api/workflow/run-named

按名称运行工作流。

#### POST /api/workflow/cleanup-test

清理测试工作流。

---

### 文档

#### GET /doc

API 文档页面（无需认证）。

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
  -d '{"model":"aigcpanel-server-tts|1.0.0","function":"soundTts","param":{"text":"你好"}}' \
  http://127.0.0.1:端口/api/model/call
```

### 查询任务结果

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"xxx"}' \
  http://127.0.0.1:端口/api/model/query
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