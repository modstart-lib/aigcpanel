package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"aigcpanel-cli/internal"

	"github.com/spf13/cobra"
)

var serverCallCmd = &cobra.Command{
	Use:   "serverCall",
	Short: "Call a model server function and wait for result",
	Long: `Call an installed AI model server function and poll until completion.

Usage:
  aigcpanel serverCall --server <name|version> --function <func> [--key value ...]

Flags:
  --server         Server key, format name|version (version optional:
                   if omitted and multiple versions match, an error is returned)
  --function       Function name (e.g. soundTts, soundClone, videoGen, asr,
                   textToImage, imageToImage, textToVideo, imageToVideo,
                   comfyui, general)
  --comfyuiName    ComfyUI workflow name for --function comfyui (e.g. textToImageFlux)
  --generalName    General model capability name for --function general (e.g. generalImage)
  --timeout        Poll timeout in seconds (default 600)

For --function general (通用模型), pass --generalName <能力名> to select the
concrete capability (e.g. generalImage), then the capability params:
  aigcpanel serverCall --server server-demo --function general \
      --generalName generalImage --prompt "..." --count 2

For --function comfyui (ComfyUI 工作流), pass --comfyuiName to select the
workflow, then the workflow params:
  aigcpanel serverCall --server server-ComfyUI --function comfyui \
      --comfyuiName generalDemo --param '{"width":512,"height":512}'

For long/array parameter values, use --keyJson /path/to/file.json.
All other --key value pairs become the function param object (--param 提供
JSON 对象，作为 function 的内部参数，与扁平 --key value 同时生效).

Examples:
  aigcpanel serverCall --server server-demo --function soundTts --text "你好"
  aigcpanel serverCall --server server-demo|1.1.0 --function asr --audio /path/to/a.wav
  aigcpanel serverCall --server server-ComfyUI|1.0.0 --function comfyui --comfyuiName textToImageFlux --param '{"width":512,"height":512}'`,
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		serverKey, function, param, timeoutSec, helpRequested, err := parseServerCallArgs(args)
		if err != nil {
			return err
		}
		if helpRequested {
			return cmd.Help()
		}
		if function == "" {
			return fmt.Errorf("--function is required")
		}
		if serverKey == "" {
			return fmt.Errorf("--server is required (format name|version, version optional)")
		}

		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}

		// Build the /api/server/call body. The server key (name|version,
		// version optional) is sent as-is and resolved server-side.
		body := map[string]any{
			"server":   serverKey,
			"function": function,
			"param":    param,
			"env":      internal.AigcPanelEnvs(),
		}

		callResult, err := internal.DoRequest(cfg, "/api/server/call", body)
		if err != nil {
			return err
		}
		code, _ := callResult["code"].(float64)
		if code != 0 {
			internal.PrintJSON(callResult)
			return fmt.Errorf("server call failed: %v", callResult["msg"])
		}
		dataMap, _ := callResult["data"].(map[string]any)
		taskId, _ := dataMap["taskId"].(string)
		if taskId == "" {
			return fmt.Errorf("no taskId returned from server call")
		}
		fmt.Fprintf(os.Stderr, "taskId=%s (polling up to %ds)\n", taskId, timeoutSec)

		return internal.PollServerTask(cfg, taskId, time.Duration(timeoutSec)*time.Second)
	},
}

// parseServerCallArgs parses --server/--function/--timeout
// and distributes every other --key value pair into the param object.
func parseServerCallArgs(args []string) (serverKey, function string, param map[string]any, timeoutSec int, helpRequested bool, err error) {
	param = map[string]any{}
	timeoutSec = 600

	type kv struct{ key, value string }
	var pairs []kv
	i := 0
	for i < len(args) {
		arg := args[i]
		if arg == "--help" || arg == "-h" {
			return "", "", nil, 0, true, nil
		}
		if !strings.HasPrefix(arg, "--") {
			i++
			continue
		}
		key := strings.TrimPrefix(arg, "--")
		if i+1 >= len(args) || strings.HasPrefix(args[i+1], "--") {
			fmt.Fprintf(os.Stderr, "warning: flag --%s has no value, ignoring\n", key)
			i++
			continue
		}
		value := args[i+1]
		i += 2
		switch key {
		case "server":
			serverKey = value
		case "function":
			function = value
		case "timeout":
			var n int
			if _, scanErr := fmt.Sscanf(value, "%d", &n); scanErr == nil && n > 0 {
				timeoutSec = n
			} else {
				fmt.Fprintf(os.Stderr, "warning: invalid --timeout %q, using %d\n", value, timeoutSec)
			}
		default:
			// 保留原始 key，交给 second pass 处理：
			//   - --keyJson 后缀的文件读取必须在驼峰转换之前判断（避免 Json 被转义）
			//   - 其余参数名统一小写驼峰（兼容中划线旧写法，--comfyui-name → comfyuiName 等）
			//   - --comfyuiName / --generalName 等扁平参数通过此路径进入 param 顶层，
			//     --param 提供的 JSON 对象则作为 function 内部参数（param.param）
			pairs = append(pairs, kv{key, value})
		}
	}

	// Distribute remaining pairs into the param object
	for _, p := range pairs {
		key, value := p.key, p.value

		// JSON file flag: --keyJson /path/to/file.json（先于驼峰转换判断）
		if strings.HasSuffix(key, "Json") {
			realKey := toCamelCase(strings.TrimSuffix(key, "Json"))
			fileBytes, readErr := os.ReadFile(value)
			if readErr != nil {
				err = fmt.Errorf("cannot read JSON file for --%s: %w", key, readErr)
				return
			}
			var parsed any
			if jsonErr := json.Unmarshal(fileBytes, &parsed); jsonErr != nil {
				err = fmt.Errorf("invalid JSON in file for --%s: %w", key, jsonErr)
				return
			}
			param[realKey] = parsed
			continue
		}

		// 中划线参数名统一映射为驼峰（与 serverSetting 一致）：
		// --video-path → videoPath、--audio-path → audioPath；已是驼峰的保持不变
		key = toCamelCase(key)

		// Auto-parse JSON arrays/objects
		trimmed := strings.TrimSpace(value)
		var parsedValue any
		if (strings.HasPrefix(trimmed, "[") && strings.HasSuffix(trimmed, "]")) ||
			(strings.HasPrefix(trimmed, "{") && strings.HasSuffix(trimmed, "}")) {
			var parsed any
			if jsonErr := json.Unmarshal([]byte(trimmed), &parsed); jsonErr == nil {
				parsedValue = parsed
			} else {
				parsedValue = value
			}
		} else {
			parsedValue = value
		}
		param[key] = parsedValue
	}
	return serverKey, function, param, timeoutSec, false, nil
}
