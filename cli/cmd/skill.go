package cmd

import (
	"fmt"
	"strings"

	"aigcpanel-cli/internal"
	"aigcpanel-cli/internal/skilldoc"

	"github.com/spf13/cobra"
)

var (
	skillJSON bool
	skillRaw  bool
)

var skillCmd = &cobra.Command{
	Use:   "skill",
	Short: "Print the bundled usage guide",
	Long: `Print the AIGCPanel usage guide bundled with this CLI build.

The guide covers CLI commands, parameters, HTTP endpoints and built-in tools,
and always matches the version of the aigcpanel binary you are running.

Use --json for scripts, or --raw to get the file verbatim with frontmatter.

Examples:
  aigcpanel skill
  aigcpanel skill --json
  aigcpanel skill --raw > aigcpanel-skill.md`,
	Args: cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		doc := skilldoc.Load()
		if skillJSON {
			// version is the CLI build version, matching `aigcpanel version`.
			return internal.PrintJSON(map[string]string{
				"name":        doc.Name,
				"description": doc.Description,
				"version":     appVersion,
				"body":        doc.Body,
			})
		}
		if skillRaw {
			fmt.Print(skilldoc.Raw())
			return nil
		}
		body := doc.Body
		if body != "" && !strings.HasSuffix(body, "\n") {
			body += "\n"
		}
		fmt.Print(body)
		return nil
	},
}

func init() {
	skillCmd.Flags().BoolVar(&skillJSON, "json", false, "print the guide as JSON")
	skillCmd.Flags().BoolVar(&skillRaw, "raw", false, "print the embedded file verbatim")
	skillCmd.MarkFlagsMutuallyExclusive("json", "raw")
}
