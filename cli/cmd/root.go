package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var appVersion string

// Execute sets the version and runs the root command.
func Execute(version string) {
	appVersion = version
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

var rootCmd = &cobra.Command{
	Use:   "aigcpanel",
	Short: "AIGCPanel CLI",
	Long:  "AIGCPanel command-line tool for interacting with the local AIGCPanel service.",
	// 运行时错误不打印 usage，保持脚本输出简洁
	SilenceUsage: true,
}

func init() {
	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(serverListCmd)
	rootCmd.AddCommand(serverComfyuiListCmd)
	rootCmd.AddCommand(serverCallCmd)
	rootCmd.AddCommand(toolsCmd)
	rootCmd.AddCommand(serverInstallCmd)
	rootCmd.AddCommand(serverPrepareCmd)
	rootCmd.AddCommand(serverRemoveCmd)
	rootCmd.AddCommand(serverLogCmd)
	rootCmd.AddCommand(serverSettingCmd)
}
