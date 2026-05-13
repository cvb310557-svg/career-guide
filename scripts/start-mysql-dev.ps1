$ErrorActionPreference = 'Stop'

$mysqlBase = 'C:\Program Files\MySQL\MySQL Server 8.4'
$mysqld = Join-Path $mysqlBase 'bin\mysqld.exe'
$dataDir = Join-Path $env:USERPROFILE '.career-guide-mysql-data'
$iniPath = Join-Path $env:USERPROFILE '.career-guide-my.ini'
$logFile = Join-Path $env:USERPROFILE '.career-guide-mysql.log'

if (!(Test-Path $mysqld)) {
    throw "mysqld.exe not found at $mysqld"
}

if (!(Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
    & $mysqld --initialize-insecure --datadir=$dataDir --console
}

$ini = @"
[mysqld]
basedir=$($mysqlBase.Replace('\','/'))
datadir=$($dataDir.Replace('\','/'))
innodb-undo-directory=$($dataDir.Replace('\','/'))
port=3306
bind-address=127.0.0.1
log-error=$($logFile.Replace('\','/'))
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

[client]
port=3306
host=127.0.0.1
user=root
"@
Set-Content -Path $iniPath -Value $ini -Encoding ASCII

$listening = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if ($listening) {
    Write-Output 'MySQL is already listening on 127.0.0.1:3306.'
    exit 0
}

# The winget MySQL 8.4 MSI can leave undo files that block a manual dev restart.
# Move them aside before start; MySQL recreates them when needed.
$undoFiles = @('undo_001', 'undo_002')
$existingUndo = $undoFiles | ForEach-Object { Join-Path $dataDir $_ } | Where-Object { Test-Path $_ }
if ($existingUndo.Count -gt 0) {
    $backupDir = Join-Path $env:USERPROFILE ('.career-guide-mysql-undo-backup-' + (Get-Date -Format 'yyyyMMddHHmmss'))
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    foreach ($file in $existingUndo) {
        Move-Item -LiteralPath $file -Destination (Join-Path $backupDir (Split-Path $file -Leaf))
    }
}

Start-Process -FilePath $mysqld -ArgumentList "--defaults-file=$iniPath" -WindowStyle Hidden
Start-Sleep -Seconds 5

$listening = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if (!$listening) {
    throw "MySQL did not start. Check log: $logFile"
}

Write-Output 'MySQL started on 127.0.0.1:3306.'
