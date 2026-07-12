#!/usr/bin/env bash
# Workshop Host Companion — double-clickable launcher for macOS/Linux.
# See README.md in this same folder before running this.
set -e
cd "$(dirname "$0")"
node workshop-host-companion.js "$@"
