$ErrorActionPreference = 'Stop'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path -LiteralPath $chrome)) { throw 'Google Chrome no encontrado' }
$desktop = [Environment]::GetFolderPath('Desktop')
$base = Join-Path $env:LOCALAPPDATA 'BTC-Intelligence'
$icon = Join-Path $base 'BTC-Intelligence.ico'
if (-not (Test-Path -LiteralPath $icon)) { throw 'Falta el icono propio: ejecute create_windows_icon.py' }
$profile = Join-Path $base 'ChromeProfile'
$shortcut = Join-Path $desktop 'BTC Intelligence.lnk'
$wsh = New-Object -ComObject WScript.Shell
$link = $wsh.CreateShortcut($shortcut)
$link.TargetPath = $chrome
$link.Arguments = ('--user-data-dir="' + $profile + '" --no-first-run --disable-background-mode --app=https://pedroluis921115-eng.github.io/btc-intelligence-v1/')
$link.WorkingDirectory = (Split-Path $chrome)
$link.IconLocation = ($icon + ',0')
$link.Description = 'BTC Intelligence: analisis manual BTCUSDT. Solo funciona mientras se abre su ventana.'
$link.Save()
$test = $wsh.CreateShortcut($shortcut)
if ($test.TargetPath -ne $chrome -or $test.Arguments -notlike '*--app=https://pedroluis921115-eng.github.io/btc-intelligence-v1/*' -or $test.Arguments -notlike '*ChromeProfile*') { throw 'Acceso directo no verificado' }
Write-Output ('SHORTCUT_PASS: ' + $shortcut)
Write-Output ('TARGET: ' + $test.TargetPath)
Write-Output ('ARGS: ' + $test.Arguments)
Write-Output ('ICON: ' + $test.IconLocation)
