' Doctor Clinic Portable — Start Application
' Double-click this file to start the application.

Dim shell, fileSystem, currentDir, backendDir

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

' Get current directory
currentDir = fileSystem.GetParentFolderName(WScript.ScriptFullName)
backendDir = currentDir & "\backend"

' Check if Node.js is installed by checking the exit code
Dim nodeCheck
nodeCheck = shell.Run("cmd /c node --version >nul 2>&1", 0, True)

If nodeCheck <> 0 Then
    MsgBox "Node.js is not installed or not in PATH." & vbCrLf & vbCrLf & _
           "Please install Node.js from https://nodejs.org/", vbCritical, "Doctor Clinic — Missing Dependency"
    WScript.Quit 1
End If

' Install dependencies if node_modules doesn't exist yet
If Not fileSystem.FolderExists(backendDir & "\node_modules") Then
    shell.Run "cmd /c cd /d """ & backendDir & """ && npm install", 1, True

    ' Re-patch @prisma/client/default.js (Node v24 dotfile workaround)
    ' Run both echo commands in a single cmd.exe invocation
    shell.Run "cmd /c (echo const path=require('path');^& echo module.exports={...require(path.join(__dirname,'.prisma/client/default'))}) > """ & backendDir & "\node_modules\@prisma\client\default.js""", 1, True
End If

' Check if database exists, if not, generate Prisma, push schema, and seed minimal data (no demo data)
Dim dbPath
dbPath = backendDir & "\prisma\dev.db"
If Not fileSystem.FileExists(dbPath) Then
    shell.Run "cmd /c cd /d """ & backendDir & """ && node scripts\generate.js", 1, True
    shell.Run "cmd /c cd /d """ & backendDir & """ && npx prisma db push --skip-generate", 1, True
    ' Seed only essential users (superadmin + admin), no demo data
    shell.Run "cmd /c cd /d """ & backendDir & """ && node prisma\seed.minimal.js", 1, True
End If

' Always regenerate Prisma Client to ensure the path is correct
shell.Run "cmd /c cd /d """ & backendDir & """ && npx prisma generate", 1, True

' Start the server in a normal window (so user can see output)
shell.Run "cmd /c title Doctor Clinic Server && cd /d """ & backendDir & """ && echo Server starting... && node server.js", 1, False

' Wait then open browser
WScript.Sleep 3000
shell.Run "http://localhost:3000"
