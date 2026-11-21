package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// AuthConfig holds the port and token read from cli-auth.json
type AuthConfig struct {
	Port  int    `json:"port"`
	Token string `json:"token"`
}

// expandHome expands a leading "~" to the user home directory.
// - "~"        → <home>
// - "~/xxx"    → <home>/xxx
// - "/abs/path → unchanged
// Mirrors the expansion applied by aigcpanel-pro electron/lib/clientConfig.ts.
func expandHome(value string) (string, error) {
	if value == "~" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return home, nil
	}
	if len(value) > 2 && (value[:2] == "~/" || value[:2] == `~\`) {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, value[2:]), nil
	}
	return value, nil
}

// userDataDir returns the Electron userData directory path matching app.getPath('userData')
// which uses the app name "aigcpanel".
//
// Priority (mirrors electron/lib/clientConfig.ts loadClientConfig):
//   1. AIGCPANEL_DATA_ROOT environment variable (non-empty, supports "~" expansion)
//      — when the installed AIGCPanel redirects its whole userData directory
//        (database/storage/cli-auth.json/logs) to an isolated data root, the CLI
//        must read cli-auth.json from the same directory.
//   2. Fallback to the platform default userData path.
func userDataDir() (string, error) {
	if envDataRoot := os.Getenv("AIGCPANEL_DATA_ROOT"); envDataRoot != "" {
		dir, err := expandHome(envDataRoot)
		if err != nil {
			return "", err
		}
		return dir, nil
	}
	switch runtime.GOOS {
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, "Library", "Application Support", "aigcpanel"), nil
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			return "", fmt.Errorf("APPDATA environment variable not set")
		}
		return filepath.Join(appData, "aigcpanel"), nil
	default:
		// Linux: XDG_CONFIG_HOME or ~/.config
		configDir := os.Getenv("XDG_CONFIG_HOME")
		if configDir == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return "", err
			}
			configDir = filepath.Join(home, ".config")
		}
		return filepath.Join(configDir, "aigcpanel"), nil
	}
}

// LoadAuthConfig reads cli-auth.json from the aigcpanel userData directory.
func LoadAuthConfig() (*AuthConfig, error) {
	dir, err := userDataDir()
	if err != nil {
		return nil, fmt.Errorf("cannot determine userData directory: %w", err)
	}
	filePath := filepath.Join(dir, "cli-auth.json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("cannot read %s: %w (is AIGCPanel running?)", filePath, err)
	}
	var cfg AuthConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("invalid cli-auth.json: %w", err)
	}
	if cfg.Port == 0 || cfg.Token == "" {
		return nil, fmt.Errorf("cli-auth.json is incomplete (port=%d, token empty=%v)", cfg.Port, cfg.Token == "")
	}
	return &cfg, nil
}
