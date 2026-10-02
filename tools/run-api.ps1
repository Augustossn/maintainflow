$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $root '.env'
if (-not (Test-Path -LiteralPath $envFile)) { & (Join-Path $PSScriptRoot 'setup.ps1') }
$values = @{}
Get-Content -LiteralPath $envFile | ForEach-Object { if ($_ -match '^([A-Z_]+)=(.*)$') { $values[$Matches[1]] = $Matches[2] } }
$env:Jwt__Key = $values.JWT_KEY
$env:Auth__DemoPassword = $values.DEMO_PASSWORD
$env:Auth__DemoEnabled = 'true'
$env:Database__Initialize = 'true'
$env:Database__Seed = 'true'
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ConnectionStrings__Database = "Server=localhost;Database=MaintainFlow;User Id=sa;Password=$($values.SQL_PASSWORD);TrustServerCertificate=True"
$env:RabbitMQ__Uri = "amqp://maintainflow:$($values.RABBIT_PASSWORD)@localhost:5672"
$env:Frontend__Origin = 'http://localhost:5184'
$env:OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4317'
$localSdk = Join-Path $root '.dotnet/dotnet.exe'
$dotnetCommand = if (Test-Path -LiteralPath $localSdk) { $localSdk } else { 'dotnet' }
& $dotnetCommand run --project (Join-Path $root 'backend/Api') --urls http://localhost:5000
