# API Service Documentation

AIGCPanel has a built-in HTTP API service that supports remote invocation of model services and tools via HTTP protocol, making it easy to integrate with third-party systems or automation workflows.

---

## Service Address

The API service always listens on `127.0.0.1` (local only). Enable "LAN Access" in "Settings - API Service" to also allow devices on the same LAN to access it via the machine's LAN IP; the LAN service address and port are then shown in the settings.

---

## Authentication

All endpoints (except `/doc`) require Bearer Token authentication via the `Authorization` header:

```
Authorization: Bearer <YourToken>
```

The token is configured under "Settings - API Service - Access Token". CLI tools read this token automatically, so no manual configuration is needed.

---

## Endpoints

### Model Management

#### POST /api/model/list

Get the list of installed model services.

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
| type | string | Model type (local / remote / cloud / comfyui) |
| requirements | object | Hardware requirements (minDisk / minMemory / minGpu / minGpuMemory / deviceDescription) |
| functions | array | Function list with name / title / description / args / param (detailed field definitions) / result |
| settings | array | Model settings (GPU selection, timeout, etc.) |

#### POST /api/model/call

Call a model service function, returns a taskId asynchronously.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| model | string | Service identifier, format `name\|version`, version is optional |
| function | string | Function name to call |
| param | object | Function parameters |
| param.param | object | Dynamic parameter object |

**Response example:**

```json
{
  "code": 0,
  "data": { "taskId": "lz3k8m2abc1" }
}
```

#### POST /api/model/query

Query task result with long polling (up to 60 seconds).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| taskId | string | Task ID returned by /api/model/call |

**Response example (processing):**

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
      "type": "success",
      "start": 1714300000000,
      "end": 1714300005000,
      "data": { "url": "/path/to/output.wav" }
    }
  }
}
```

#### POST /api/model/log

View model service logs.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, format `name\|version` or just `name` |

#### POST /api/model/setting

Set model service parameters (gpu, idleTimeout, etc.).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, format `name\|version` or just `name` |
| setting | object | Parameters to set (merged with existing settings, effective after restart) |

#### POST /api/model/workflows

Get ComfyUI model workflow list (VIP users only).

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, only valid for ComfyUI type models |

---

### Server Management

#### POST /api/server/list

Get server list. Same as /api/model/list.

#### POST /api/server/install

Install a model service from a local directory.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| path | string | Absolute path to the model directory, must contain config.json. Automatically overwrites if same name and version exist (upsert). |

#### POST /api/server/remove

Uninstall an installed model service.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| server | string | Model identifier, format `name\|version` or just `name` |

---

### File Upload

#### POST /api/upload

Upload a file to the temp directory. Supports two mutually exclusive methods.

**Method 1: multipart/form-data**

| Field | Type | Description |
|-------|------|-------------|
| file | file | File to upload, field name `file`, any format, max 2GB |

**Method 2: JSON body**

| Field | Type | Description |
|-------|------|-------------|
| fileBase64 | string | Base64 encoded file content, supports `data:image/png;base64,xxxx` format or raw Base64 string |
| name | string | File name (optional, auto-generated if not provided) |

**Response example:**

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

Uploaded files are saved to the temp directory. The returned `path` can be used in subsequent `/api/model/call` calls as `param.audio`, `param.video`, `param.image`, etc. Files are periodically cleaned up automatically.

---

### Tools

#### POST /api/tools/submit

Submit a tool task.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| biz | string | Tool type, e.g. SoundGenerate, VideoGen, VideoCompress |
| param | object | Tool parameters |
| modelConfig | object | Model configuration |
| title | string | Task title (optional) |
| env | object | Environment variables (optional) |

#### POST /api/tools/continue

Continue a paused task.

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| taskId | string | Task ID |
| stage | string | Current stage |
| data | object | Stage data |
| env | object | Environment variables (optional) |

---

### Workflow

#### POST /api/workflow/list

Get workflow list.

#### POST /api/workflow/run

Run a workflow.

#### POST /api/workflow/query

Query workflow status.

---

## Usage Examples

### List installed models

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  http://127.0.0.1:port/api/model/list
```

### View model parameters

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"server":"aigcpanel-server-tts|1.0.0"}' \
  http://127.0.0.1:port/api/model/info
```

### Call TTS

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"model":"aigcpanel-server-tts|1.0.0","function":"soundTts","param":{"text":"Hello"}}' \
  http://127.0.0.1:port/api/model/call
```

### Query task result

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"xxx"}' \
  http://127.0.0.1:port/api/model/query
```

### Upload file (multipart)

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -F "file=@/path/to/audio.wav" \
  http://127.0.0.1:port/api/upload
```

### Upload file (Base64 JSON)

```bash
curl -X POST \
  -H "Authorization: Bearer <Token>" \
  -H "Content-Type: application/json" \
  -d '{"fileBase64":"data:audio/wav;base64,//uQxAAA..."}' \
  http://127.0.0.1:port/api/upload
```