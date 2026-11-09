# Eldock - server zavodu jako naplanovana uloha po startu Windows (ucet SYSTEM) + pravidlo brany firewall.
# Spustte jako spravce (z instalacni slozky Eldock\resources):
#   powershell -ExecutionPolicy Bypass -File plant-server-task.ps1 [-Port 8787] [-DataDir "C:\ProgramData\Eldock\Server zavodu"]
#   powershell -ExecutionPolicy Bypass -File plant-server-task.ps1 -Remove      (odebrani ulohy a pravidla; data zustanou)
param(
  [int]$Port = 8787,
  [string]$DataDir = (Join-Path $env:ProgramData "Eldock\Server zavodu"),
  [switch]$Remove
)
$ErrorActionPreference = "Stop"
$TaskName = "Eldock - server zavodu"
$Launcher = Join-Path $PSScriptRoot "plant-server.cmd"

if ($Remove) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Remove-NetFirewallRule -DisplayName $TaskName -ErrorAction SilentlyContinue
  Write-Host "Uloha a pravidlo brany firewall odebrany. Data zustala v $DataDir."
  return
}

if (-not (Test-Path $Launcher)) { throw "Nenalezen $Launcher - spustte skript ze slozky Eldock\resources." }
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
# Data serveru (vcetne tokenu cloudu) jen pro SYSTEM a spravce
icacls $DataDir /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null

$Action = New-ScheduledTaskAction -Execute $Launcher -Argument "--data `"$DataDir`" --port $Port"
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null

if (-not (Get-NetFirewallRule -DisplayName $TaskName -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName $TaskName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Domain,Private | Out-Null
}
Start-ScheduledTask -TaskName $TaskName
Write-Host "Server zavodu bezi na portu $Port. Sprava: http://localhost:$Port (prvni nastaveni jen na tomto pocitaci). Data: $DataDir"
