@echo off
rem Portfolio local admin server auto-start (called by start-hidden.vbs on login)
rem If port 5173 is already listening, exit silently to avoid duplicates.
netstat -ano | findstr /C:":5173" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 exit /b 0
cd /d D:\GitHub-myfiles\portfolio
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'server.js' -WorkingDirectory 'D:\GitHub-myfiles\portfolio' -WindowStyle Hidden"
