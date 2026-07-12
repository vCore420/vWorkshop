# Workshop Host Companion — launcher for Windows PowerShell.
# See README.md in this same folder before running this.
#
# If PowerShell refuses to run this script at all, that's Windows' own
# script-execution policy protecting you from untrusted scripts by
# default — a good instinct in general. Either run
# `powershell -ExecutionPolicy Bypass -File start.ps1` for this one
# script, or start the Companion directly instead:
#   node workshop-host-companion.js

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir
node workshop-host-companion.js $args
