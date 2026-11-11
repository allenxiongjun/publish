Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell -NoProfile -WindowStyle Hidden -File ""D:\GitHub-myfiles\portfolio\watchdog.ps1""", 0, False
