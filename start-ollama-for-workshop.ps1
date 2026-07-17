<#
--------------------------------------------------
vWorkshop - Ollama Launcher

Starts a local Ollama server configured for
vWorkshop development and GitHub Pages.

Run this before opening the Workshop.
--------------------------------------------------
#>

$env:OLLAMA_ORIGINS = "http://127.0.0.1:5500,https://vcore420.github.io"

Write-Host ""
Write-Host "Restarting Ollama for vWorkshop..."
Write-Host ""

# Stop any existing Ollama server
Get-Process ollama -ErrorAction SilentlyContinue | Stop-Process -Force

# Start a fresh server with the correct environment
ollama serve