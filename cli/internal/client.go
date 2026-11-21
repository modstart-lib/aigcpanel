package internal

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// DoRequest sends a POST request to the local AIGCPanel HTTP server.
func DoRequest(cfg *AuthConfig, urlPath string, body any) (map[string]any, error) {
	return DoRequestMethod(cfg, http.MethodPost, urlPath, body)
}

// DoRequestMethod sends a request with the given HTTP method.
func DoRequestMethod(cfg *AuthConfig, method, urlPath string, body any) (map[string]any, error) {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
		reqBody = bytes.NewReader(b)
	}

	url := fmt.Sprintf("http://127.0.0.1:%d%s", cfg.Port, urlPath)
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.Token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w (is AIGCPanel running?)", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("unauthorized: token mismatch, restart AIGCPanel and try again")
	}

	var result map[string]any
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}
	return result, nil
}

// PrintJSON outputs a value as indented JSON to stdout.
func PrintJSON(v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(b))
	return nil
}

// AigcPanelEnvs 返回进程环境变量中所有以 AIGCPANEL_ 开头的变量，
// 用于随请求体透传给服务端（服务启动时合并进 launcher 进程环境）。
func AigcPanelEnvs() map[string]string {
	envs := map[string]string{}
	for _, kv := range os.Environ() {
		if !strings.HasPrefix(kv, "AIGCPANEL_") {
			continue
		}
		parts := strings.SplitN(kv, "=", 2)
		if len(parts) == 2 {
			envs[parts[0]] = parts[1]
		}
	}
	return envs
}
