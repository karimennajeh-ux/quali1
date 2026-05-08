Set shell = CreateObject("WScript.Shell")
scriptPath = "D:\stage prjet fin d'étude 2026\cahier de charge d'application\scripts\launch_quali_local.ps1"
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptPath & """", 0, False
