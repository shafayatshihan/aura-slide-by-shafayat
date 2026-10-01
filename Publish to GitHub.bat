@echo off
rem For Shafayat only (not included in the user download): save and upload all changes to GitHub.
title Lumi publish
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\publish.ps1"
if errorlevel 1 pause
