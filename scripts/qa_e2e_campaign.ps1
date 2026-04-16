param(
  [switch]$SkipTypecheck,
  [switch]$SkipUnitTests,
  [string]$DeviceInfo = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$now = Get-Date
$stamp = $now.ToString("yyyyMMdd_HHmmss")
$reportsDir = Join-Path $root "docs/reports"
if (-not (Test-Path $reportsDir)) {
  New-Item -ItemType Directory -Path $reportsDir | Out-Null
}

$reportPath = Join-Path $reportsDir ("QA_E2E_REPORT_{0}.md" -f $stamp)

$results = @()

function Invoke-Step {
  param(
    [string]$Name,
    [string]$Command,
    [switch]$Skip
  )

  if ($Skip) {
    $results += [pscustomobject]@{
      Name = $Name
      Command = $Command
      Status = "SKIPPED"
      ExitCode = 0
      Output = "Paso omitido por parametro."
    }
    return
  }

  Write-Host "[QA] Ejecutando: $Name"
  $output = cmd /c "$Command 2>&1"
  $exitCode = $LASTEXITCODE

  $status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }

  $results += [pscustomobject]@{
    Name = $Name
    Command = $Command
    Status = $status
    ExitCode = $exitCode
    Output = ($output -join "`n")
  }
}

Invoke-Step -Name "Typecheck" -Command "npm run typecheck" -Skip:$SkipTypecheck
Invoke-Step -Name "Unit Tests" -Command "npm run test" -Skip:$SkipUnitTests

$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$skipCount = ($results | Where-Object { $_.Status -eq "SKIPPED" }).Count

$deviceLine = if ([string]::IsNullOrWhiteSpace($DeviceInfo)) { "(por completar manualmente)" } else { $DeviceInfo }

$md = @()
$md += "# QA E2E Report"
$md += ""
$md += "- Fecha: $($now.ToString('yyyy-MM-dd HH:mm:ss'))"
$md += "- Dispositivo: $deviceLine"
$md += "- Rama/Commit: por completar manualmente"
$md += ""
$md += "## Resumen automatizado"
$md += ""
$md += "| Paso | Estado | Código salida |"
$md += "|---|---|---|"
foreach ($r in $results) {
  $md += "| $($r.Name) | $($r.Status) | $($r.ExitCode) |"
}
$md += ""
$md += "- PASS: $passCount"
$md += "- FAIL: $failCount"
$md += "- SKIPPED: $skipCount"
$md += ""
$md += "## Escenarios E2E reproducibles (manuales guiados)"
$md += ""
$md += "| ID | Escenario | Estado app | Resultado esperado | Evidencia | Estado |"
$md += "|---|---|---|---|---|---|"
$md += "| N-A1 | done/skip/postpone/start_task | Foreground | Estado aplicado en store/UI | screenshot + hora | [ ] |"
$md += "| N-B1 | done/skip/postpone/start_task | Background | Cambio aplicado al volver | screenshot + hora | [ ] |"
$md += "| N-C1 | done/skip/postpone/start_task | Cold start | Acción procesada al abrir | screenshot + hora | [ ] |"
$md += "| T-01 | Timeline integrity | Normal | Sin mover bloques fijos/rutina | video corto | [ ] |"
$md += "| O-01 | Overflow prompt | Normal | Selección protege tareas y pospone resto | screenshot + hora | [ ] |"
$md += "| M-01 | Métricas accionables | Stats | Drill-down muestra contexto real | screenshot + hora | [ ] |"
$md += "| E-01 | Observabilidad | Stats | Bitácora muestra decisión y motivo | screenshot + hora | [ ] |"
$md += ""
$md += "## Salida de comandos"
$md += ""
foreach ($r in $results) {
  $md += "### $($r.Name)"
  $md += ""
  $md += "- Comando: $($r.Command)"
  $md += "- Estado: $($r.Status)"
  $md += ""
  $md += '```text'
  $md += $r.Output
  $md += '```'
  $md += ""
}

Set-Content -Path $reportPath -Value ($md -join [Environment]::NewLine) -Encoding UTF8
Write-Host "[QA] Reporte generado en: $reportPath"

if ($failCount -gt 0) {
  exit 1
}

exit 0
