<#
--------------------------------------------------
vWorkshop - Ollama Startup

Allows the hosted Workshop to communicate with
the local Ollama server.

Run this before opening the Workshop.
--------------------------------------------------
#>

# Allow the Workshop GitHub Pages site to connect
$env:OLLAMA_ORIGINS = "http://127.0.0.1:5500,https://vcore420.github.io"

try {
    Invoke-RestMethod "http://localhost:11434/api/tags" | Out-Null

    Write-Host "Ollama is already running."
}
catch {
    Write-Host "Starting Ollama..."
    ollama serve
}