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

var toolsCmd = &cobra.Command{
	Use:   "tools",
	Short: "Call a built-in tool and wait for result",
	Long: `Call a built-in AIGCPanel tool (tool invocation) and poll until completion.

Usage:
  aigcpanel tools --name <tool> --param '<json>'
  aigcpanel tools --name <tool> --taskId <id> --stage <stage> --param '<json>'

Flags:
  --name     Required. Tool type (e.g. VideoCompress, SoundGenerate)
  --taskId   Task ID of a paused tool task to continue (used with --stage)
  --stage    Stage name to continue (e.g. Config, Confirm)
  --param    JSON string of tool params. On submit it becomes the modelConfig;
             on continue (with --stage) it becomes the stage data.

All tool-specific parameters are passed through --param as a single JSON
string (no flattened flags).

Examples:
  aigcpanel tools --name VideoCompress --param '{"file":"/path/to/video.mp4","codec":"libx264"}'
  aigcpanel tools --name SoundGenerate --param '{"text":"Hello world"}'
  aigcpanel tools --name VideoZoom --param '{"video":"/path/to/video.mp4"}'
  aigcpanel tools --name VideoZoom --taskId 123 --stage Config --param '{"times":[{"startMs":500,"endMs":2500}]}'`,
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		name, taskId, stage, param, helpRequested, err := parseToolsArgs(args)
		if err != nil {
			return err
		}
		if helpRequested {
			return cmd.Help()
		}
		if name == "" {
			return fmt.Errorf("--name is required")
		}

		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}

		// Continue a paused task
		if taskId != "" && stage != "" {
			continueResult, err := internal.DoRequest(cfg, "/api/tools/continue", map[string]any{
				"taskId": taskId,
				"stage":  stage,
				"data":   param,
				"env":    internal.AigcPanelEnvs(),
			})
			if err != nil {
				return err
			}
			cCode, _ := continueResult["code"].(float64)
			if cCode != 0 {
				return internal.PrintJSON(continueResult)
			}
			// Poll for result after continue
			return internal.PollServerTask(cfg, taskId, 120*time.Second)
		}

		// Submit new task
		submitResult, err := internal.DoRequest(cfg, "/api/tools/submit", map[string]any{
			"biz":         name,
			"modelConfig": param,
			"env":         internal.AigcPanelEnvs(),
		})
		if err != nil {
			return err
		}

		code, _ := submitResult["code"].(float64)
		if code != 0 {
			internal.PrintJSON(submitResult)
			return fmt.Errorf("task submit failed: %v", submitResult["msg"])
		}

		dataMap, _ := submitResult["data"].(map[string]any)
		newTaskId, _ := dataMap["taskId"].(string)
		if newTaskId == "" {
			return fmt.Errorf("no taskId returned from task submit")
		}

		return internal.PollServerTask(cfg, newTaskId, 120*time.Second)
	},
}

// parseToolsArgs manually parses the tools arguments.
// Reserved flat flags: --name, --taskId, --stage.
// All tool-specific parameters are passed through --param as a JSON string
// and become either the modelConfig (submit) or the stage data (continue).
func parseToolsArgs(args []string) (name, taskId, stage string, param map[string]any, helpRequested bool, err error) {
	param = map[string]any{}

	i := 0
	for i < len(args) {
		arg := args[i]
		if arg == "--help" || arg == "-h" {
			return "", "", "", nil, true, nil
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
		case "name":
			name = value
		case "taskId":
			taskId = value
		case "stage":
			stage = value
		case "param":
			var parsed map[string]any
			if jsonErr := json.Unmarshal([]byte(value), &parsed); jsonErr != nil {
				err = fmt.Errorf("--param must be a JSON object: %w", jsonErr)
				return
			}
			param = parsed
		default:
			fmt.Fprintf(os.Stderr, "warning: unknown flag --%s, ignoring (use --param to pass tool params)\n", key)
		}
	}
	return name, taskId, stage, param, false, nil
}
