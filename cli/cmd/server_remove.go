package cmd

import (
	"fmt"
	"strings"

	"aigcpanel-cli/internal"

	"github.com/spf13/cobra"
)

var serverRemoveCmd = &cobra.Command{
	Use:   "serverRemove",
	Short: "Remove an installed model server",
	Long: `Remove an installed model server record from AIGCPanel.

Usage:
  aigcpanel serverRemove --server <name|version>
  aigcpanel serverRemove --server server-demo

Flags:
  --server   Server key, format name|version (version optional:
             if omitted and multiple versions match, an error is returned)

Examples:
  aigcpanel serverRemove --server server-demo|1.1.0
  aigcpanel serverRemove --server server-demo`,
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		serverKey, helpRequested, err := parseServerKeyArgs(args)
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
		result, err := internal.DoRequest(cfg, "/api/server/remove", map[string]any{
			"server": serverKey,
		})
		if err != nil {
			return err
		}
		return internal.PrintJSON(result)
	},
}

// parseServerKeyArgs parses --server and --help flags.
func parseServerKeyArgs(args []string) (serverKey string, helpRequested bool, err error) {
	i := 0
	for i < len(args) {
		arg := args[i]
		if arg == "--help" || arg == "-h" {
			return "", true, nil
		}
		if !strings.HasPrefix(arg, "--") {
			i++
			continue
		}
		key := strings.TrimPrefix(arg, "--")
		if i+1 >= len(args) || strings.HasPrefix(args[i+1], "--") {
			return "", false, fmt.Errorf("flag --%s requires a value", key)
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
	return serverKey, false, nil
}
