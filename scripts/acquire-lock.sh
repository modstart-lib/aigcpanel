#!/bin/sh

# Acquire an exclusive automation-test lock. Sourced by the Makefile:
#   . scripts/acquire-lock.sh "dev-seed-test"
#
# The lock is a file under <project>/_temp that records the holder PID:
#   _temp/dev-seed-test.lock
#
# Behavior:
#   - Create the lock file atomically (noclobber refuses to overwrite).
#   - If another process holds the lock and is still alive, print its PID and
#     wait until it finishes. A live lock is never ignored.
#   - If the recorded PID is gone (crashed/killed), ignore the stale lock and
#     take over immediately.

LOCK_NAME="$1"
if [ -z "$LOCK_NAME" ]; then
  LOCK_NAME="aigcpanel"
fi

LOCK_ROOT="${AIGCPANEL_LOCK_ROOT:-_temp}"
mkdir -p "$LOCK_ROOT"
LOCK_FILE="$LOCK_ROOT/${LOCK_NAME}.lock"
export AIGCPANEL_LOCK_FILE="$LOCK_FILE"

LOCKED_PID=""
LAST_PID=""
while ! ( set -C; printf '%s\n' "$$" > "$LOCK_FILE" ) 2>/dev/null; do
  LOCKED_PID="$(cat "$LOCK_FILE" 2>/dev/null || true)"
  if [ -z "$LOCKED_PID" ]; then
    # The owner may not have written its PID yet, give it a moment before judging.
    sleep 1
    LOCKED_PID="$(cat "$LOCK_FILE" 2>/dev/null || true)"
  fi

  if [ -n "$LOCKED_PID" ] && kill -0 "$LOCKED_PID" 2>/dev/null; then
    # Holder is alive: the lock cannot be ignored, wait for it to be released.
    if [ "$LOCKED_PID" != "$LAST_PID" ]; then
      echo "[lock] 其他进程正在进行测试（持有锁 PID: ${LOCKED_PID}），等待其结束后自动继续..." >&2
      LAST_PID="$LOCKED_PID"
    fi
    sleep 2
    continue
  fi

  if [ -n "$LOCKED_PID" ]; then
    echo "[lock] 持有锁的进程已不存在（PID: ${LOCKED_PID}），忽略残留锁并接管" >&2
  else
    echo "[lock] 检测到无主锁（未记录 PID），忽略锁并接管" >&2
  fi
  rm -f "$LOCK_FILE"
done

echo "[lock] 已获取测试锁（PID: $$）"
