@echo off
rem 个人作品集本地服务静默自启脚本（由启动文件夹 start-hidden.vbs 隐藏调用）
rem 若 5173 端口已有服务在监听则直接退出，避免重复启动
netstat -ano | findstr /C:":5173" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 exit /b 0
cd /d D:\GitHub-myfiles\portfolio
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'server.js' -WorkingDirectory 'D:\GitHub-myfiles\portfolio' -WindowStyle Hidden"
