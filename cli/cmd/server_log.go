package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"aigcpanel-cli/internal"

	"github.com/spf13/cobra"
)

// readJSONFile reads and returns the raw bytes of a file.
func readJSONFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

var serverLogCmd = &cobra.Command{
	Use:   "serverLog",
	Short: "Show the log of an installed model server",
	Long: `Show the latest log of an installed AI model server.

Usage:
  aigcpanel serverLog --server <name|version>
  aigcpanel serverLog --server server-demo

Flags:
  --server   Server key, format name|version (version optional:
             if omitted and multiple versions match, an error is returned)
  --json     Output the full JSON response (file + content)

Examples:
  aigcpanel serverLog --server server-ComfyUI
  aigcpanel serverLog --server server-ComfyUI|1.0.0`,
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		serverKey, outputJSON, helpRequested, err := parseServerLogArgs(args)
		if err != nil {
			return err
		}
		if helpRequested {
			return cmd.Help()
		}
		if serverKey == "" {
			return fmt.Errorf("--server is required (format name|version, version optional)")
		}
		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}
		result, err := internal.DoRequest(cfg, "/api/server/log", map[string]any{
			"server": serverKey,
		})
		if err != nil {
			return err
		}
		if outputJSON {
			return internal.PrintJSON(result)
		}
		code, _ := result["code"].(float64)
		if code != 0 {
			return internal.PrintJSON(result)
		}
		data, _ := result["data"].(map[string]any)
		file, _ := data["file"].(string)
		content, _ := data["content"].(string)
		if file != "" {
			fmt.Printf("=== %s ===\n", file)
		} else {
			fmt.Println("=== no log file ===")
		}
		fmt.Print(content)
		if content == "" {
			fmt.Println("(empty)")
		}
		return nil
	},
}

// parseServerLogArgs parses --server/--json/--help.
func parseServerLogArgs(args []string) (serverKey string, outputJSON, helpRequested bool, err error) {
	i := 0
	for i < len(args) {
		arg := args[i]
		if arg == "--help" || arg == "-h" {
			return "", false, true, nil
		}
		if !strings.HasPrefix(arg, "--") {
			i++
			continue
		}
		key := strings.TrimPrefix(arg, "--")
		// --json 为布尔标志（无值），放在值检查之前处理
		if key == "json" {
			outputJSON = true
			i++
			continue
		}
		if i+1 >= len(args) || strings.HasPrefix(args[i+1], "--") {
			return "", false, false, fmt.Errorf("flag --%s requires a value", key)
		}
		value := args[i+1]
		i += 2
		switch key {
		case "server":
			serverKey = value
		default:
			fmt.Printf("warning: unknown flag --%s, ignoring\n", key)
		}
	}
	return serverKey, outputJSON, false, nil
}

// parseSettingArgs parses --server plus every other --key value
// pair into a setting object. --settingJson /path/to/file.json reads a JSON file.
func parseSettingArgs(args []string) (serverKey string, setting map[string]any, helpRequested bool, err error) {
	setting = map[string]any{}
	i := 0
	for i < len(args) {
		arg := args[i]
		if arg == "--help" || arg == "-h" {
			return "", nil, true, nil
		}
		if !strings.HasPrefix(arg, "--") {
			i++
			continue
		}
		key := strings.TrimPrefix(arg, "--")
		if i+1 >= len(args) || strings.HasPrefix(args[i+1], "--") {
			return "", nil, false, fmt.Errorf("flag --%s requires a value", key)
		}
		value := args[i+1]
		i += 2
		switch key {
		case "server":
			serverKey = value
		default:
			if strings.HasSuffix(key, "Json") {
				realKey := toCamelCase(strings.TrimSuffix(key, "Json"))
				fileBytes, readErr := readJSONFile(value)
				if readErr != nil {
					return "", nil, false, fmt.Errorf("cannot read JSON file for --%s: %w", key, readErr)
				}
				var parsed any
				if jsonErr := json.Unmarshal(fileBytes, &parsed); jsonErr != nil {
					return "", nil, false, fmt.Errorf("invalid JSON in file for --%s: %w", key, jsonErr)
				}
				setting[realKey] = parsed
				continue
			}
			// 参数名统一小写驼峰（--idleTimeout → idleTimeout；兼容旧中划线写法
			// --idle-timeout → idleTimeout），与服务端字段一致
			setting[toCamelCase(key)] = value
		}
	}
	return serverKey, setting, false, nil
}

// toCamelCase converts a kebab-case flag name to camelCase
// (--idle-timeout → idleTimeout). camelCase names pass through unchanged.
func toCamelCase(key string) string {
	parts := strings.Split(key, "-")
	for i := 1; i < len(parts); i++ {
		if parts[i] != "" {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, "")
}
