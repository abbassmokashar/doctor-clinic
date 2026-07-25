' Doctor Clinic Portable — Stop Application
' Double-click this file to stop the application.
' It kills the Node.js server process running on port 3000.

Dim shell

Set shell = CreateObject("WScript.Shell")

' Find and kill the Node.js process running on port 3000
shell.Run "cmd /c for /f ""tokens=5"" %a in ('netstat -ano ^| findstr :3000 ^| findstr LISTEN') do taskkill /PID %a /F", 0, True

' Also kill any node processes that were started from the backend directory
shell.Run "cmd /c wmic process where ""name='node.exe' and commandline like '%backend%'"" call terminate", 0, True

MsgBox "Doctor Clinic has been stopped.", vbInformation, "Doctor Clinic — Stopped"
