@echo off
chcp 65001 >nul
setlocal EnableExtensions
title DESINSTALAR - PELEGO MARCADOR DE TELA
set "APPDIR=%LOCALAPPDATA%\Programs\PELEGO Marcador de Tela"

taskkill /IM PELEGO.ScreenInk.exe /F >nul 2>&1

for %%F in ("%APPDIR%\unins*.exe") do (
  if exist "%%~fF" (
    start /wait "" "%%~fF"
    exit /b 0
  )
)

rem Fallback para limpar instalações antigas caso o desinstalador do Inno não exista.
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "PELEGO Marcador de Tela" /f >nul 2>&1
reg delete "HKCU\Software\PELEGO\MarcadorTelaV2" /f >nul 2>&1
if exist "%APPDIR%" rmdir /s /q "%APPDIR%" >nul 2>&1

echo.
echo PELEGO Marcador de Tela removido.
pause
exit /b 0
