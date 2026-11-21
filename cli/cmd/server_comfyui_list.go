package cmd

import (
	"fmt"

	"aigcpanel-cli/internal"

	"github.com/spf13/cobra"
)

var (
	serverComfyuiListServer string
)

var serverComfyuiListCmd = &cobra.Command{
	Use:   "serverComfyuiList",
	Short: "List workflows of a ComfyUI server",
	Long: `List workflows of an installed ComfyUI server (VIP users only).

Usage:
  aigcpanel serverComfyuiList --server <name|version>
  aigcpanel serverComfyuiList --server server-ComfyUI

Flags:
  --server   Server key, format name|version (version optional:
             if omitted and multiple versions match, an error is returned)

Examples:
  aigcpanel serverComfyuiList --server server-ComfyUI|1.0.0
  aigcpanel serverComfyuiList --server server-ComfyUI --json`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if serverComfyuiListServer == "" {
			return fmt.Errorf("--server is required (format name|version, version optional)")
		}
		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}
		result, err := internal.DoRequest(cfg, "/api/server/workflows", map[string]any{
			"server": serverComfyuiListServer,
		})
		if err != nil {
			return err
		}
		code, _ := result["code"].(float64)
		if code != 0 {
			return internal.PrintJSON(result)
		}
		data, _ := result["data"].(map[string]any)
		vip, _ := data["vip"].(bool)
		if !vip {
			return internal.PrintJSON(map[string]any{
				"vip":       false,
				"workflows": []any{},
				"msg":       "workflow list requires a VIP user",
			})
		}
		// 摘要输出（--json 输出完整响应含 param 定义）
		if !hasFlag(args, "--json") {
			workflows, _ := data["workflows"].([]any)
			summary := make([]map[string]any, 0, len(workflows))
			for _, w := range workflows {
				if wf, ok := w.(map[string]any); ok {
					summary = append(summary, map[string]any{
						"key":           wf["key"],
						"title":         wf["title"],
						"description":   wf["description"],
						"biz":           wf["biz"],
						"hasUserConfig": wf["hasUserConfig"],
					})
				}
			}
			return internal.PrintJSON(map[string]any{
				"vip":       true,
				"workflows": summary,
			})
		}
		return internal.PrintJSON(result)
	},
}

func init() {
	serverComfyuiListCmd.Flags().StringVar(&serverComfyuiListServer, "server", "", "Server key (format name|version, version optional)")
}
