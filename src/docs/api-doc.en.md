# API Service Documentation

AIGCPanel has a built-in HTTP API service that supports remote invocation of model services, built-in tools and workflows over HTTP, making it easy to integrate with third-party systems or automation workflows.

---

## Service Address

The API service listens on `127.0.0.1` by default (local only). Enable "LAN Access" in "Settings - API Service" to also allow devices on the same LAN to access it via the machine's LAN IP; the LAN service address and port are then shown in the settings. Below, `http://127.0.0.1:PORT` stands for the service address.

---

## Authentication

Every endpoint except `/doc` requires the access token, sent one of two ways:

```
Authorization: Bearer <YourToken>
```

```
Api-Token: <YourToken>
```

`X-Api-Token` is accepted too. The token is configured under "Settings - API Service - Access Token". CLI tools read it automatically, so no manual configuration is needed.

---

## Endpoints

### Model Management

#### POST /api/model/list

Get the concise list of installed model services.

**Request body:** No parameters, send empty JSON `{}`

**Response example:**

```json
{
  "code": 0,
  "data": [
    {
      "id": "aigcpanel-server-tts|1.0.0",
      "name": "aigcpanel-server-tts",
      "version": "1.0.0",
      "title": "TTS",
      "type": "local",
      "description": "Text to speech",
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
        "description": "Text to speech",
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

Get detailed parameter information of a specific model (including field definitions, settings, hardware requirements).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, format `name\|version` or just `name` |

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique model ID `name\|version` |
| name | string | Model name |
| version | string | Model version |
| title | string | Display name |
| description | string | Model description |
| type | string | Model type (local / localDir / remote / cloud / comfyui) |
| requirements | object | Hardware requirements (minDisk / minMemory / minGpu / minGpuMemory / deviceDescription) |
| functions | array | Function list with name / title / description / args / param (detailed field definitions) / result |
| settings | array | Model settings (GPU selection, timeout, etc.) |
| config | object | Trimmed config.json (entry / cloudName / autoStart) |

**Response example:**

```json
{
  "code": 0,
  "data": {
    "id": "aigcpanel-server-tts|1.0.0",
    "name": "aigcpanel-server-tts",
    "version": "1.0.0",
    "title": "TTS",
    "description": "Text to speech",
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
        "title": "TTS",
        "description": "Synthesize text to natural speech",
        "args": ["text"],
        "param": [
          {
            "name": "speaker",
            "title": "Speaker",
            "type": "select",
            "default": "default",
            "required": false,
            "options": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"]
          }
        ],
        "result": [
          {
            "name": "url",
            "title": "Audio file path",
            "type": "string",
            "description": "Path of the generated audio file"
          }
        ]
      }
    ],
    "settings": [
      { "name": "gpu", "title": "GPU", "type": "gpuSelector", "default": "" }
    ],
    "config": { "entry": "", "cloudName": "", "autoStart": true }
  }
}
```

---

### Model Invocation

#### POST /api/server/list

Get the installed model service list with fields similar to `/api/model/list` (`id`, `name`, `version`, `title`, `functions`).

**Request body:** No parameters, send empty JSON `{}`

#### POST /api/server/call

Call a model function. Returns a `taskId` asynchronously.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, format `name\|version`; version optional |
| function | string | Function name: `soundTts`, `soundClone`, `videoGen`, `asr`, `textToImage`, `imageToImage`, `textToVideo`, `imageToVideo`, `comfyui`, `general` |
| param | object | Function parameters. Besides the nested `param` object, include the function's own fields such as `text` for TTS |
| env | object | Optional extra `AIGCPANEL_*` environment variables |

**Example (TTS):**

```json
{
  "server": "aigcpanel-server-tts|1.0.0",
  "function": "soundTts",
  "param": {
    "text": "Hello, welcome to AIGCPanel",
    "param": { "speaker": "zh-CN-XiaoxiaoNeural" }
  }
}
```

**Example (ComfyUI workflow):**

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

**Example (general model):**

```json
{
  "server": "server-demo",
  "function": "general",
  "param": {
    "generalName": "generalImage",
    "param": { "prompt": "a cat", "count": 2 }
  }
}
```

**Response example:**

```json
{
  "code": 0,
  "data": { "taskId": "123" }
}
```

#### POST /api/server/query

Query the task result with long polling (about 60 seconds; returns `pending` on timeout).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| taskId | string | Task ID returned by `/api/server/call` or `/api/tools/submit` |

**Response example (running):**

```json
{ "code": 0, "data": { "status": "pending" } }
```

**Response example (success):**

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

**Response example (error):**

```json
{ "code": 0, "data": { "status": "error", "error": "reason" } }
```

**Response example (paused, waiting for confirmation):**

```json
{
  "code": 0,
  "data": {
    "status": "pause",
    "taskId": "123",
    "step": "Config",
    "statusMsg": "Task paused for manual confirmation"
  }
}
```

#### POST /api/server/log

Show the latest log file of a model service (at most the last 512 KB).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, `name\|version` or just `name` |

**Response example:**

```json
{
  "code": 0,
  "data": {
    "file": "server-ComfyUI_1.0.0_20260814.log",
    "content": "[I] 2026-08-14 ..."
  }
}
```

If no log exists: `{ "file": null, "content": "" }`.

#### POST /api/server/setting

Set model service parameters (gpu / idleTimeout, etc.), merged into the existing settings.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, `name\|version` or just `name` |
| setting | object | Settings object to merge |

**Response:** the merged `setting` object.

#### POST /api/server/workflows

Get the workflow list of a ComfyUI model (only VIP users receive content).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier; only ComfyUI models are supported |

Non-VIP response:

```json
{ "code": 0, "data": { "vip": false, "workflows": [] } }
```

Each workflow for VIP users contains `key`, `title`, `description`, `param`, `biz`, `hasUserConfig`.

---

### Model Installation and Weights

#### POST /api/server/install

Install a model service from a local directory.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| path | string | Absolute path of the model directory; must contain config.json. Same name+version is upserted. |

**Response:** the installed model record.

#### POST /api/server/remove

Remove an installed model service (stops the running process first).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, `name\|version` or just `name` |
| force | boolean | Optional; deletion is refused while weights are downloading unless `true` |

**Response example:**

```json
{ "code": 0, "data": { "removed": 1 } }
```

#### POST /api/server/prepare

Ensure the model weights are ready (models without a `prepare` section return ready immediately).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, `name\|version` or just `name` |
| wait | boolean | Optional, default `true` waits for completion; `false` returns current status |

#### POST /api/server/preparePause

Pause weight download, keeping downloaded files for resume. `/api/server/prepareCancel` is a compatibility alias.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, `name\|version` or just `name` |

**Response example:**

```json
{ "code": 0, "data": { "paused": true, "cancelled": true } }
```

---

### File Upload and Download

#### POST /api/upload

Upload a file to the temp directory. Two alternatives.

**Option 1: multipart/form-data**

| Field | Type | Description |
|-------|------|-------------|
| file | file | File to upload |

**Option 2: JSON**

| Field | Type | Description |
|-------|------|-------------|
| fileBase64 | string | `data:<mime>;base64,<data>` or plain base64 |
| name | string | Optional filename; generated automatically when omitted |

**Response example:**

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

Download a result file produced by a model (image / audio / video, etc.). Only files under the data directory and installed model directories are allowed.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| path | string | Absolute path of the result file (the `url` / `path` field returned by the model) |

**Response:** the file binary stream (`Content-Type` inferred from the extension).

**Example:**

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"path":"/path/to/result.png"}' \
  http://127.0.0.1:PORT/api/file/download -o result.png
```

---

### Tools

#### POST /api/tools/submit

Submit a built-in tool task.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| biz | string | Tool type, e.g. `VideoCompress`, `Ffmpeg` (required) |
| modelConfig | object | Tool parameters (a JSON string is also accepted and stored as-is) |
| param | object | Optional task parameters |
| title | string | Optional task title; defaults to `biz + "-task"` |
| env | object | Optional extra `AIGCPANEL_*` environment variables |

**Response example:**

```json
{ "code": 0, "data": { "taskId": "123" } }
```

#### POST /api/tools/continue

Continue a paused tool task (manual confirmation stage).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| taskId | string | Paused task ID (required) |
| stage | string | Current stage name (required) |
| data | object | Data to write for this stage |
| env | object | Optional extra environment variables |

Supported tools and stages: `VideoZoom` / `VideoMark` (`Config`, `RenderConfirm`), `VideoSpeedPart` / `VideoKeepPart` (`Config`), `VideoQuickCut` (`Confirm`).

**Response example:**

```json
{ "code": 0, "data": { "taskId": "123" } }
```

---

### Workflow

#### POST /api/workflow/list

Get the workflow list.

**Request body:** None

**Response example:**

```json
{ "code": 0, "data": { "list": [{ "id": 1, "name": "My flow", "createdAt": 1714300000, "updatedAt": 1714300000 }] } }
```

#### POST /api/workflow/run

Run a workflow data payload (creates a temporary workflow named `_test_…`).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| data | object | Workflow data; must contain a `nodes` array |

**Response example:**

```json
{ "code": 0, "data": { "workflowLogId": "1", "workflowId": "1" } }
```

#### POST /api/workflow/run-named

Run a saved workflow by name (the latest one with that name).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| name | string | Workflow name |

**Response:** same as above, with `workflowLogId` and `workflowId`.

#### POST /api/workflow/query

Query a workflow run with long polling (about 10 seconds; returns `pending` on timeout).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| workflowLogId | string | Log ID returned by the run endpoint |

**Response example:**

```json
{
  "code": 0,
  "data": { "status": "success", "statusMsg": "", "logData": { "nodes": [], "edges": [] } }
}
```

#### POST /api/workflow/cleanup-test

Delete test workflows (names starting with `_test_` or equal to the default new-workflow name) and their run logs.

**Request body:** None

**Response example:**

```json
{ "code": 0, "data": { "deleted": 3 } }
```

---

### Live

#### POST /api/live/tts

Synthesize text with a live voice and return the local absolute path of the audio.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| voiceId | string/number | Live voice ID (required) |
| text | string | Text to synthesize (required) |

**Response example:**

```json
{ "code": 0, "data": { "url": "/path/to/output.wav" } }
```

Returns 404 `VoiceNotFound` when the voice does not exist.

---

### Documentation

#### GET /doc

The API documentation page (no authentication). Chinese by default; `?lang=en` or `Accept-Language: en` returns the English version.

---

## Usage Examples

### List installed models

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:PORT/api/model/list
```

### View model parameters

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"server":"aigcpanel-server-tts|1.0.0"}' \
  http://127.0.0.1:PORT/api/model/info
```

### Call TTS

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"server":"aigcpanel-server-tts|1.0.0","function":"soundTts","param":{"text":"Hello"}}' \
  http://127.0.0.1:PORT/api/server/call
```

### Query task result

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"123"}' \
  http://127.0.0.1:PORT/api/server/query
```

### Upload file (multipart)

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -F "file=@/path/to/audio.wav" \
  http://127.0.0.1:PORT/api/upload
```

### Upload file (Base64 JSON)

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"fileBase64":"data:audio/wav;base64,//uQxAAA..."}' \
  http://127.0.0.1:PORT/api/upload
```

### Download a result file

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"path":"/path/to/result.png"}' \
  http://127.0.0.1:PORT/api/file/download -o result.png
```
