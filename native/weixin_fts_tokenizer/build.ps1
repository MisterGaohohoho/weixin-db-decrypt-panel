param(
    [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptRoot "..\..")).Path
$BuildDir = Join-Path $ScriptRoot "build"
$HeaderDir = Join-Path $BuildDir "sqlite-amalgamation-3530400"
$ZipFile = Join-Path $BuildDir "sqlite-amalgamation-3530400.zip"
$ZipSha256 = "1E71DDF93849C6A6ECF58B827C0692073D2DD7EE40196158068F7B29F422E87D"
$SourceFile = Join-Path $ScriptRoot "weixin_fts_tokenizer.c"

if (-not $OutFile) {
    $OutFile = Join-Path $RepoRoot "dist\weixin_fts_tokenizer.dll"
}
$OutFile = [IO.Path]::GetFullPath($OutFile)

New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutFile) | Out-Null

if (-not (Test-Path $ZipFile)) {
    Invoke-WebRequest `
        -Uri "https://www.sqlite.org/2026/sqlite-amalgamation-3530400.zip" `
        -OutFile $ZipFile
}
$ActualZipSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ZipFile).Hash
if ($ActualZipSha256 -ne $ZipSha256) {
    throw "SQLite amalgamation SHA-256 mismatch: $ActualZipSha256"
}
if (-not (Test-Path (Join-Path $HeaderDir "sqlite3ext.h"))) {
    Expand-Archive -LiteralPath $ZipFile -DestinationPath $BuildDir -Force
}

$VcVarsCandidates = @(
    "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat",
    "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat",
    "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvars64.bat",
    "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
)
$VcVars = $VcVarsCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $VcVars) {
    throw "vcvars64.bat was not found"
}

$ObjectFile = Join-Path $BuildDir "weixin_fts_tokenizer.obj"
$ImportLibrary = Join-Path $BuildDir "weixin_fts_tokenizer.lib"
$Command = @"
call "$VcVars" >nul 2>&1 && cd /d "$BuildDir" && cl /nologo /LD /O2 /W4 /utf-8 /I"$HeaderDir" /Fo:"$ObjectFile" "$SourceFile" /Fe:"$OutFile" /link /NOLOGO /IMPLIB:"$ImportLibrary" kernel32.lib
"@

& cmd.exe /d /s /c $Command
if ($LASTEXITCODE -ne 0) {
    throw "MSVC build failed with exit code $LASTEXITCODE"
}

Write-Output $OutFile
