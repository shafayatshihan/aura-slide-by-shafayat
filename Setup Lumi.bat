@echo off
rem Lumi - double-click this file to set everything up.
title Lumi setup
cd /d "%~dp0"

rem Opened straight from inside the ZIP? Windows then runs it from a temporary copy without the other files.
if not exist "%~dp0setup\setup.ps1" goto notextracted
echo "%~dp0" | findstr /i /c:"\Temp\" >nul && echo "%~dp0" | findstr /i /c:".zip" >nul && goto notextracted

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup\setup.ps1"
exit /b

:notextracted
echo.
echo   ============================================================
echo    Please extract the ZIP first.
echo.
echo    1. Close this window.
echo    2. Right-click the Lumi ZIP file and choose "Extract All".
echo    3. Open the new folder and double-click "Setup Lumi" again.
echo   ============================================================
echo.
pause
