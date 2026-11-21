package cmd

import (
	"strings"

	"aigcpanel-cli/internal"

	"github.com/spf13/cobra"
)

var serverListCmd = &cobra.Command{
	Use:   "serverList",
	Short: "List installed AI model servers",
	Long: `List installed AI model servers (AI 模型服务).

Usage:
  aigcpanel serverList

Examples:
  aigcpanel serverList

查看 ComfyUI 服务器的工作流请使用 serverComfyuiList 命令。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}
		result, err := internal.DoRequest(cfg, "/api/server/list", nil)
		if err != nil {
			return err
		}
		// 只保留 name/title/version/functions，去掉 id
		if data, ok := result["data"].([]any); ok {
			for _, item := range data {
				if server, ok := item.(map[string]any); ok {
					delete(server, "id")
				}
			}
		}
		return internal.PrintJSON(result)
	},
}

// splitServerKey splits a --server value ("name|version") into (name, version).
// version 可省略；仅传名称时 version 为空，由服务端按名称解析
// （唯一匹配执行，多个版本报错要求传递版本号）。
func splitServerKey(server string) (string, string) {
	if server == "" {
		return "", ""
	}
	if strings.Contains(server, "|") {
		parts := strings.SplitN(server, "|", 2)
		return parts[0], parts[1]
	}
	return server, ""
}

// hasFlag reports whether the args contain the given exact flag.
func hasFlag(args []string, flag string) bool {
	for _, a := range args {
		if a == flag {
			return true
		}
	}
	return false
}
