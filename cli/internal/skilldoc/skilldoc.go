// Package skilldoc embeds the usage guide printed by `aigcpanel skill`.
//
// The embedded SKILL.md is generated from skills/aigcpanel-cli-skill/SKILL.md
// by `make sync-skill`; edit the source file, never the copy.
package skilldoc

import (
	_ "embed"
	"strings"
	"sync"
)

//go:embed SKILL.md
var rawFile string

// Doc is the parsed usage guide.
type Doc struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Body        string `json:"body"`
}

var (
	loadOnce sync.Once
	loaded   Doc
)

// Load returns the embedded guide, parsed once.
func Load() Doc {
	loadOnce.Do(func() {
		loaded = Parse(rawFile)
	})
	return loaded
}

// Raw returns the embedded file verbatim, including YAML frontmatter.
func Raw() string {
	return rawFile
}

// Parse separates optional YAML frontmatter from the Markdown body.
// Only the single-line `name` and `description` fields are read; parsing is
// intentionally lenient so a malformed file still prints something useful.
func Parse(content string) Doc {
	// Normalize line endings so a copy edited on Windows still parses cleanly.
	text := strings.ReplaceAll(content, "\r\n", "\n")
	doc := Doc{Body: text}
	if !strings.HasPrefix(text, "---\n") {
		return doc
	}
	rest := text[len("---\n"):]
	end := strings.Index(rest, "\n---")
	if end < 0 {
		return doc
	}
	doc.Body = strings.TrimLeft(rest[end+len("\n---"):], "\n")
	for _, line := range strings.Split(rest[:end], "\n") {
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		switch strings.TrimSpace(key) {
		case "name":
			doc.Name = strings.TrimSpace(value)
		case "description":
			doc.Description = strings.TrimSpace(value)
		}
	}
	return doc
}
