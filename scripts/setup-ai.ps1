# One-shot AI setup: venv + CPU torch + dependencies + weights + real verification. Run from the videoguard folder.
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\..\ai-service"
$py = if (Get-Command py -ErrorAction SilentlyContinue) { "py -3.12" } else { "python" }
if (-not (Test-Path .venv)) { Invoke-Expression "$py -m venv .venv" }
$venvPy = ".\.venv\Scripts\python.exe"
& $venvPy -m pip install --upgrade pip
& $venvPy -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
& $venvPy -m pip install -r requirements-inference.txt
& $venvPy scripts\download_weights.py
& $venvPy scripts\verify_model.py
