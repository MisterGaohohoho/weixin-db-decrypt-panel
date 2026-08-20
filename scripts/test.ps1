[CmdletBinding()]
param(
    [string]$PythonPath = "",
    [switch]$SkipBrowser
)

$ErrorActionPreference = "Stop"
$PanelRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$FrontendRoot = Join-Path $PanelRoot "frontend"
$VenvPython = Join-Path $PanelRoot ".venv\Scripts\python.exe"

function Resolve-PanelPath {
    param([string]$Value, [string]$DefaultPath)
    if (-not $Value) {
        return $DefaultPath
    }
    if ([IO.Path]::IsPathRooted($Value)) {
        return [IO.Path]::GetFullPath($Value)
    }
    return [IO.Path]::GetFullPath((Join-Path $PanelRoot $Value))
}

$DatabaseRoot = Resolve-PanelPath $env:WECHAT_DB_ROOT (Join-Path $PanelRoot "data\db_decrypt\all")
$ReportPath = Resolve-PanelPath $env:WECHAT_DECRYPTION_REPORT (Join-Path $PanelRoot "data\db_decrypt\decryption_report.json")

if (-not $PythonPath) {
    $PythonPath = if (Test-Path -LiteralPath $VenvPython) {
        $VenvPython
    }
    else {
        (Get-Command python -ErrorAction Stop).Source
    }
}
$NpmPath = (Get-Command npm.cmd -ErrorAction Stop).Source

function Invoke-Checked {
    param(
        [string]$Label,
        [scriptblock]$Command
    )
    Write-Host "`n== $Label =="
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE"
    }
}

Push-Location $PanelRoot
try {
    Invoke-Checked "pytest" { & $PythonPath -m pytest }
    Invoke-Checked "Vitest" { & $NpmPath --prefix $FrontendRoot run test }
    Invoke-Checked "Frontend build" { & $NpmPath --prefix $FrontendRoot run build }
    if (-not $SkipBrowser -and (Test-Path -LiteralPath $DatabaseRoot) -and (Test-Path -LiteralPath $ReportPath)) {
        $env:PLAYWRIGHT_PYTHON = $PythonPath
        Invoke-Checked "Playwright e2e" { & $NpmPath --prefix $FrontendRoot run test:e2e }
    }
    elseif (-not $SkipBrowser) {
        Write-Host "`n== Playwright skipped: local decrypted snapshot is unavailable =="
    }
}
finally {
    Pop-Location
}
