param(
    [string]$SolutionId = ""
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "=== CTM RH | Publicação no Power Apps ===" -ForegroundColor Cyan

if (-not (Test-Path "power.config.json")) {
    throw "power.config.json não encontrado. Execute primeiro .\\scripts\\INICIAR-POWERAPPS.ps1"
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependências..." -ForegroundColor Cyan
    npm install
}

if (-not (Test-Path "node_modules/.bin/pa.cmd")) {
    throw "Power Apps CLI local não encontrada. Execute npm install."
}

Write-Host "Validando tipos..." -ForegroundColor Cyan
npm run typecheck

if ($LASTEXITCODE -ne 0) {
    throw "Falha na validação de tipos. A publicação foi cancelada."
}

Write-Host "Validando build..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -ne 0 -or -not (Test-Path "dist/index.html")) {
    throw "Build inválido: dist/index.html não foi gerado."
}

Write-Host "Publicando Code App..." -ForegroundColor Cyan
if ([string]::IsNullOrWhiteSpace($SolutionId)) {
    & npx --no-install pa app push
} else {
    & npx --no-install pa app push --solution-id $SolutionId
}

if ($LASTEXITCODE -ne 0) {
    throw "Falha na publicação do Code App."
}

Write-Host "Publicação concluída." -ForegroundColor Green
