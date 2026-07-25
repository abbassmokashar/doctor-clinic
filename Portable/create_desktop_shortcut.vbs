' Doctor Clinic Portable — Create Desktop Shortcut
' Double-click this file to create a shortcut on your desktop.

Dim shell, desktopPath, shortcut, currentDir, fileSystem

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

' Get paths
desktopPath = shell.SpecialFolders("Desktop")
currentDir = fileSystem.GetParentFolderName(WScript.ScriptFullName)

' Create shortcut
Set shortcut = shell.CreateShortcut(desktopPath & "\Doctor Clinic Portable.lnk")
shortcut.TargetPath = currentDir & "\start.vbs"
shortcut.WorkingDirectory = currentDir
shortcut.Description = "Doctor Clinic Portable — Launch Application"
shortcut.WindowStyle = 1 ' Normal

' Set icon (use the Node.js icon if available, otherwise default)
On Error Resume Next
shortcut.IconLocation = currentDir & "\backend\node_modules\.bin\node.exe, 0"
On Error GoTo 0

shortcut.Save

MsgBox "Desktop shortcut created!" & vbCrLf & vbCrLf & _
       "You can now launch Doctor Clinic Portable " & vbCrLf & _
       "from your desktop.", vbInformation, "Doctor Clinic — Shortcut Created"
