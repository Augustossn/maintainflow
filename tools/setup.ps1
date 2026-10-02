$ErrorActionPreference = 'Stop'
$target = Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
if (Test-Path -LiteralPath $target) { Write-Host '.env já existe. Nenhuma credencial foi alterada.'; exit }
function New-LocalPassword { return 'Mf!' + [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)) }
$demo = New-LocalPassword
@("SQL_PASSWORD=$(New-LocalPassword)", "RABBIT_PASSWORD=$(New-LocalPassword)", "JWT_KEY=$(New-LocalPassword)", "DEMO_PASSWORD=$demo", "GRAFANA_PASSWORD=$(New-LocalPassword)") | Set-Content -LiteralPath $target
Write-Host '.env criado com credenciais únicas. Consulte DEMO_PASSWORD no arquivo para entrar.'
