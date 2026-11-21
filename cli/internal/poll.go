package internal

import (
	"fmt"
	"time"
)

// PollServerTask polls /api/server/query until the task reaches a terminal
// state (success / pause / error / fail) or the timeout elapses.
// The final JSON response is printed; an error is returned when the task
// fails or the timeout is reached (so the CLI exits non-zero).
func PollServerTask(cfg *AuthConfig, taskId string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		queryResult, err := DoRequest(cfg, "/api/server/query", map[string]any{
			"taskId": taskId,
		})
		if err != nil {
			return err
		}
		qCode, _ := queryResult["code"].(float64)
		if qCode != 0 {
			return PrintJSON(queryResult)
		}
		qData, _ := queryResult["data"].(map[string]any)
		status, _ := qData["status"].(string)
		switch status {
		case "success", "pause":
			return PrintJSON(queryResult)
		case "error", "fail":
			PrintJSON(queryResult)
			return fmt.Errorf("task %s ended with status %q", taskId, status)
		default:
			time.Sleep(500 * time.Millisecond)
			continue
		}
	}
	PrintJSON(map[string]any{
		"code": -1,
		"msg":  "timeout waiting for task result",
	})
	return fmt.Errorf("timeout waiting for task result: %s", taskId)
}
