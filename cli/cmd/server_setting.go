package cmd

import (
	"aigcpanel-cli/internal"

	"github.com/spf13/cobra"
)

var serverSettingCmd = &cobra.Command{
	Use:   "serverSetting",
	Short: "Set parameters of an installed model server",
	Long: `Set parameters (e.g. gpu, idleTimeout) of an installed AI model server.

Usage:
  aigcpanel serverSetting --server <name|version> [--key value ...]

Flags:
  --server    Server key, format name|version (version optional:
              if omitted and multiple versions match, an error is returned)
  --key value Any other --key value pair becomes a setting entry.
              Use --keyJson /path/to/file.json for JSON values.

Examples:
  aigcpanel serverSetting --server server-ComfyUI --gpu 0 --idleTimeout 120
  aigcpanel serverSetting --server server-ComfyUI|1.0.0 --settingJson '{"gpu":"0","idleTimeout":120}'`,
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		serverKey, setting, helpRequested, err := parseSettingArgs(args)
		if err != nil {
			return err
		}
		if helpRequested {
			return cmd.Help()
		}
		if serverKey == "" {
			return cmd.Help()
		}
		if len(setting) == 0 {
			return cmd.Help()
		}
		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}
		result, err := internal.DoRequest(cfg, "/api/server/setting", map[string]any{
			"server":  serverKey,
			"setting": setting,
		})
		if err != nil {
			return err
		}
		return internal.PrintJSON(result)
	},
}
