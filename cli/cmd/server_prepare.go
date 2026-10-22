package cmd

import (
	"fmt"
	"os"
	"strings"

	"aigcpanel-cli/internal"

	"github.com/spf13/cobra"
)

var serverPrepareCmd = &cobra.Command{
	Use:   "serverPrepare",
	Short: "Download model weights for an installed server (prepare)",
	Long: `Ensure the model weights required by a server are downloaded and verified.

Models packaged with weights-on-demand (config.json has a "prepare" section)
do not ship weights; the first use downloads them from the declared sources.
This command waits for the download to finish (use --status to only query).

Usage:
  aigcpanel serverPrepare --server <name>|v<version> [--status]

Flags:
  --server   Required. Server name, or "name|version"
  --status   Only print the current prepare status (do not wait)
  --pause    Pause the running download (keeps downloaded files for resume)
  --cancel   Alias of --pause

Examples:
  aigcpanel serverPrepare --server IndexTTS25
  aigcpanel serverPrepare --server "server-IndexTTS25|1.0.0" --status`,
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		server, onlyStatus, cancel, helpRequested, err := parseServerPrepareArgs(args)
		if err != nil {
			return err
		}
		if helpRequested {
			return cmd.Help()
		}
		if server == "" {
			return fmt.Errorf("--server is required")
		}
		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}
		if cancel {
			result, err := internal.DoRequest(cfg, "/api/server/preparePause", map[string]any{
				"server": server,
			})
			if err != nil {
				return err
			}
			return internal.PrintJSON(result)
		}
		body := map[string]any{
			"server": server,
			"wait":   !onlyStatus,
		}
		result, err := internal.DoRequest(cfg, "/api/server/prepare", body)
		if err != nil {
			return err
		}
		if onlyStatus {
			fmt.Fprintf(cmd.ErrOrStderr(), "status for %s\n", server)
		}
		return internal.PrintJSON(result)
	},
}

func parseServerPrepareArgs(args []string) (server string, onlyStatus bool, cancel bool, helpRequested bool, err error) {
	i := 0
	for i < len(args) {
		arg := args[i]
		if arg == "--help" || arg == "-h" {
			return "", false, false, true, nil
		}
		if arg == "--status" {
			onlyStatus = true
			i++
			continue
		}
		if arg == "--cancel" || arg == "--pause" {
			cancel = true
			i++
			continue
		}
		if !strings.HasPrefix(arg, "--") {
			i++
			continue
		}
		key := strings.TrimPrefix(arg, "--")
		if i+1 >= len(args) || strings.HasPrefix(args[i+1], "--") {
			return "", false, false, false, fmt.Errorf("flag --%s requires a value", key)
		}
		value := args[i+1]
		i += 2
		switch key {
		case "server":
			server = value
		default:
			fmt.Fprintf(os.Stderr, "warning: unknown flag --%s, ignoring\n", key)
		}
	}
	return server, onlyStatus, cancel, false, nil
}
