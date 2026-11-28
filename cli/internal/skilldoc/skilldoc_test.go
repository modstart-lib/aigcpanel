package skilldoc

import (
	"strings"
	"testing"
)

func TestLoadParsesEmbeddedGuide(t *testing.T) {
	doc := Load()

	if doc.Name != "aigcpanel-cli-skill" {
		t.Errorf("Name = %q, want aigcpanel-cli-skill", doc.Name)
	}
	if doc.Description == "" {
		t.Error("Description is empty")
	}
	if doc.Body == "" {
		t.Fatal("Body is empty")
	}
	if strings.HasPrefix(doc.Body, "---") {
		t.Error("Body still starts with frontmatter")
	}
	for _, want := range []string{
		"aigcpanel serverCall",
		"aigcpanel serverPrepare",
		"aigcpanel tools",
		"aigcpanel skill",
	} {
		if !strings.Contains(doc.Body, want) {
			t.Errorf("Body does not mention %q", want)
		}
	}
	if strings.TrimSpace(Raw()) == "" {
		t.Error("Raw is empty")
	}
	if !strings.HasPrefix(Raw(), "---\n") {
		t.Error("Raw does not keep frontmatter")
	}
}

func TestParseWithoutFrontMatter(t *testing.T) {
	const content = "# Title\n\nbody\n"
	doc := Parse(content)

	if doc.Body != content {
		t.Errorf("Body = %q, want %q", doc.Body, content)
	}
	if doc.Name != "" || doc.Description != "" {
		t.Errorf("unexpected frontmatter fields: name=%q description=%q", doc.Name, doc.Description)
	}
}

func TestParseHandlesCRLF(t *testing.T) {
	doc := Parse("---\r\nname: demo\r\ndescription: 测试说明\r\n---\r\n\r\n# Body\r\n")

	if doc.Name != "demo" {
		t.Errorf("Name = %q, want demo", doc.Name)
	}
	if doc.Description != "测试说明" {
		t.Errorf("Description = %q, want 测试说明", doc.Description)
	}
	if !strings.HasPrefix(doc.Body, "# Body") {
		t.Errorf("Body = %q, want it to start with # Body", doc.Body)
	}
}

func TestParseUnclosedFrontMatterFallsBackToBody(t *testing.T) {
	const content = "---\nname: demo\n# no closing fence\n"
	doc := Parse(content)

	if doc.Body != content {
		t.Errorf("Body = %q, want the original content", doc.Body)
	}
	if doc.Name != "" {
		t.Errorf("Name = %q, want empty", doc.Name)
	}
}
