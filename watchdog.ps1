# 月裁织梦本地服务器守护脚本
# 每30秒检查一次5173端口，没在跑就自动拉起
$port = 5173
$workDir = "D:\GitHub-myfiles\portfolio"
$nodeExe = "C:\Program Files\nodejs\node.exe"

while ($true) {
    $running = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue
    if (-not $running.TcpTestSucceeded) {
        Start-Process -FilePath $nodeExe -ArgumentList "server.js" -WorkingDirectory $workDir -WindowStyle Hidden
        Start-Sleep -Seconds 5
    }
    Start-Sleep -Seconds 30
}
