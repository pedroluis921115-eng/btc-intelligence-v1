$ErrorActionPreference = 'Stop'
$shortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'BTC Intelligence.lnk'
$marker = 'BTC-Intelligence\ChromeProfile'
function TargetProcesses {
  @(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like ('*'+$marker+'*') })
}
$initial = @(TargetProcesses)
if ($initial.Count -gt 0) { Write-Output 'SHORTCUT_SHUTDOWN_HOLD: a dedicated session was already running, not closing existing user work'; exit 2 }
$os = Get-CimInstance Win32_OperatingSystem
Write-Output ('RAM_BEFORE_MIB=' + [math]::Round($os.FreePhysicalMemory/1024,0))
Start-Process -FilePath $shortcut
Start-Sleep -Seconds 6
$running = @(TargetProcesses)
Write-Output ('DEDICATED_CHROME_PROCESSES_OPEN=' + $running.Count)
if ($running.Count -eq 0) { Write-Output 'SHORTCUT_LAUNCH_HOLD: no dedicated processes'; exit 3 }
$windows = @($running | ForEach-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue } | Where-Object { $_ -and $_.MainWindowHandle -ne 0 })
Write-Output ('DEDICATED_WINDOWS=' + $windows.Count)
if ($windows.Count -eq 0) { Write-Output 'SHORTCUT_SHUTDOWN_HOLD: cannot identify window safely'; exit 4 }
foreach ($p in $windows) { [void]$p.CloseMainWindow() }
Start-Sleep -Seconds 7
$remaining = @(TargetProcesses)
$after = Get-CimInstance Win32_OperatingSystem
Write-Output ('RAM_AFTER_MIB=' + [math]::Round($after.FreePhysicalMemory/1024,0))
Write-Output ('DEDICATED_CHROME_PROCESSES_AFTER=' + $remaining.Count)
if ($remaining.Count -eq 0) { Write-Output 'SHORTCUT_CLOSE_PASS_NO_RESIDENT_CHROME_PROFILE'; exit 0 }
Write-Output 'SHORTCUT_CLOSE_HOLD_BACKGROUND_PROCESSES'; exit 5
