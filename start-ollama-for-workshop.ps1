# start-ollama-for-workshop.ps1
# -------------------------------
# The Workshop's own AI Mission Control / Bubble talk to a *local* Ollama
# server (see docs/AI.md) — but Ollama's own default CORS policy only
# allows requests from a small set of origins, and doesn't include
# wherever you're actually running the Workshop from (a local dev server,
# a GitHub Pages deployment, or Chrome/Edge's own "installed PWA" origin).
# Without OLLAMA_ORIGINS set correctly *before* Ollama starts, every
# request from the Workshop will fail with what looks like "Ollama isn't
# running" even though it is.
#
# This script sets OLLAMA_ORIGINS for the current session only (it
# doesn't touch your permanent environment variables) and then starts
# `ollama serve`. Close this window (or Ctrl+C) to stop the server again.
#
# When to use this:
#   - You want to talk to Bubble, or use AI Mission Control, with a real
#     local model.
#   - You've already installed Ollama (https://ollama.com) and pulled at
#     least one model (e.g. `ollama pull llama3.2`).
#   - You don't already run `ollama serve` some other way with
#     OLLAMA_ORIGINS configured globally — if you do, you don't need this
#     script at all; it's purely a convenience for the common case.
#
# How to use it:
#   1. Right-click this file in File Explorer and choose "Run with
#      PowerShell" — or open a PowerShell window in this folder and run:
#        .\start-ollama-for-workshop.ps1
#   2. Leave the window open while you use the Workshop. Closing it stops
#      Ollama.
#   3. Open the Workshop as usual (local dev server, or your deployed
#      URL) and open AI Mission Control — it should show "Connected"
#      within a few seconds.
#
# If PowerShell refuses to run this script at all ("running scripts is
# disabled on this system"), that's Windows' own script-execution policy,
# not a problem with this script — run PowerShell as Administrator once
# and execute:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
# then try again.

Write-Host "Starting Ollama for the Workshop..." -ForegroundColor Cyan

# Covers the common cases: a local dev server on any port, an installed
# PWA (which Chromium reports as a null/opaque origin, hence the "*"
# fallback), and a GitHub Pages deployment. If you're hosting the
# Workshop somewhere else entirely, add that origin to this list too —
# comma-separated, no spaces around the commas.
$env:OLLAMA_ORIGINS = "http://localhost:*,http://127.0.0.1:*,https://*.github.io,*"

Write-Host "OLLAMA_ORIGINS set to: $env:OLLAMA_ORIGINS" -ForegroundColor DarkGray
Write-Host "Starting 'ollama serve' — leave this window open, close it (or Ctrl+C) to stop." -ForegroundColor Cyan
Write-Host ""

ollama serve
