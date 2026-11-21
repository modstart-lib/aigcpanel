#!/bin/sh

# Release the automation-test lock created by acquire-lock.sh.
# The exact lock file path is exported by acquire-lock.sh as AIGCPANEL_LOCK_FILE.

if [ -n "$AIGCPANEL_LOCK_FILE" ]; then
  rm -f "$AIGCPANEL_LOCK_FILE"
fi
