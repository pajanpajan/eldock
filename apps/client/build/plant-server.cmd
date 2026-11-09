@echo off
rem Eldock - server zavodu: Eldock.exe jako Node (bez okna a bez Chromia). Volby: --data, --port, --host
set ELECTRON_RUN_AS_NODE=1
"%~dp0..\Eldock.exe" "%~dp0app.asar.unpacked\dist-electron\plant-server.cjs" %*
