package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"aigcpanel-cli/internal"

	"github.com/spf13/cobra"
)

var serverInstallCmd = &cobra.Command{
	Use:   "serverInstall",
	Short: "Install a model server from a local directory",
	Long: `Install a model server from a local directory into AIGCPanel.

Usage:
  aigcpanel serverInstall --dir /path/to/model-dir

Flags:
  --dir   Required. Local directory containing config.json

The directory's config.json is read to register the model (name/version/
functions/settings), then the server record is stored in AIGCPanel so the
model appears in the installed model list. Same name+version is upserted.

Examples:
  aigcpanel serverInstall --dir ../aigcpanel-server-demo`,
	DisableFlagParsing: true,
	RunE: func(cmd *cobra.Command, args []string) error {
		dir, helpRequested, err := parseServerInstallArgs(args)
		if err != nil {
			return err
		}
		if helpRequested {
			return cmd.Help()
		}
		if dir == "" {
			return fmt.Errorf("--dir is required")
		}

		absDir, err := filepath.Abs(dir)
		if err != nil {
			return fmt.Errorf("cannot resolve --dir: %w", err)
		}
		stat, err := os.Stat(absDir)
		if err != nil || !stat.IsDir() {
			return fmt.Errorf("directory not found: %s", absDir)
		}

		// Read config.json locally to show what is being installed
		configPath := filepath.Join(absDir, "config.json")
		configBytes, err := os.ReadFile(configPath)
		if err != nil {
			return fmt.Errorf("cannot read %s: %w (is this a model server directory?)", configPath, err)
		}
		var config map[string]any
		if err := json.Unmarshal(configBytes, &config); err != nil {
			return fmt.Errorf("invalid config.json: %w", err)
		}
		name, _ := config["name"].(string)
		version, _ := config["version"].(string)
		if name == "" || version == "" {
			return fmt.Errorf("config.json missing name/version")
		}
		title, _ := config["title"].(string)
		functions, _ := config["functions"].([]any)
		fmt.Fprintf(os.Stderr, "Installing model: %s (%s) v%s, functions: %v\n", name, title, version, functions)

		cfg, err := internal.LoadAuthConfig()
		if err != nil {
			return err
		}
		result, err := internal.DoRequest(cfg, "/api/server/install", map[string]any{
			"path": absDir,
		})
		if err != nil {
			return err
		}
		return internal.PrintJSON(result)
	},
}

// parseServerInstallArgs parses --dir and --help flags.
func parseServerInstallArgs(args []string) (dir string, helpRequested bool, err error) {
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
		case "dir":
			dir = value
		default:
			fmt.Fprintf(os.Stderr, "warning: unknown flag --%s, ignoring\n", key)
		}
	}
	return dir, false, nil
}
