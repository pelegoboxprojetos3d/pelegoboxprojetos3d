@echo off
chcp 65001 >nul
setlocal EnableExtensions
title LIMPEZA COMPLETA - PELEGO MARCADOR DE TELA

color 0C
cls
echo ============================================================
echo      REMOVER COMPLETAMENTE - PELEGO MARCADOR DE TELA
echo ============================================================
echo.
echo Este removedor apaga SOMENTE o PELEGO MARCADOR DE TELA.
echo NAO remove PELEGO RADIO.
echo.
echo Serao removidos:
echo   - aplicativo e versoes antigas
echo   - inicializacao automatica
echo   - atalhos
echo   - configuracoes
echo   - entradas em Aplicativos Instalados
echo   - restos temporarios conhecidos
echo.
choice /C SN /N /M "Deseja continuar? [S/N]: "
if errorlevel 2 exit /b 0

echo.
echo [1/7] Encerrando processos...
taskkill /F /IM "PELEGO.ScreenInk.exe" >nul 2>&1
taskkill /F /IM "PELEGO-Marcador.exe" >nul 2>&1
taskkill /F /IM "PELEGO Marcador de Tela.exe" >nul 2>&1
timeout /t 1 /nobreak >nul 2>&1

echo [2/7] Executando desinstalador oficial, se existir...
set "APPDIR=%LOCALAPPDATA%\Programs\PELEGO Marcador de Tela"
for %%U in ("%APPDIR%\unins*.exe") do (
    if exist "%%~fU" start "" /wait "%%~fU" /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
)

echo [3/7] Removendo inicializacao automatica...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "PELEGO Marcador de Tela" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "PELEGO Marcador" /f >nul 2>&1

echo [4/7] Removendo configuracoes e entradas antigas...
reg delete "HKCU\Software\PELEGO\MarcadorTelaV2" /f >nul 2>&1
reg delete "HKCU\Software\PELEGO\MarcadorDeTela" /f >nul 2>&1
reg delete "HKCU\Software\PELEGO\MarcadorTela" /f >nul 2>&1

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$roots=@('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'); foreach($r in $roots){if(Test-Path $r){Get-ChildItem $r -ErrorAction SilentlyContinue | ForEach-Object {$p=Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue; if($p.DisplayName -like 'PELEGO Marcador de Tela*' -or $p.DisplayName -like 'PELEGO Marcador*'){Remove-Item $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue}}}}" >nul 2>&1

echo [5/7] Removendo atalhos...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$places=@([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('Programs'),[Environment]::GetFolderPath('Startup')); foreach($p in $places){if(Test-Path $p){Get-ChildItem $p -Recurse -ErrorAction SilentlyContinue | Where-Object {$_.Name -like '*PELEGO*Marcador*'} | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue}}" >nul 2>&1

echo [6/7] Apagando pastas e restos locais...
if exist "%LOCALAPPDATA%\Programs\PELEGO Marcador de Tela" rmdir /S /Q "%LOCALAPPDATA%\Programs\PELEGO Marcador de Tela" >nul 2>&1
if exist "%LOCALAPPDATA%\PELEGO Marcador de Tela" rmdir /S /Q "%LOCALAPPDATA%\PELEGO Marcador de Tela" >nul 2>&1
if exist "%LOCALAPPDATA%\PELEGO\Marcador de Tela" rmdir /S /Q "%LOCALAPPDATA%\PELEGO\Marcador de Tela" >nul 2>&1
if exist "%APPDATA%\PELEGO Marcador de Tela" rmdir /S /Q "%APPDATA%\PELEGO Marcador de Tela" >nul 2>&1
if exist "%APPDATA%\PELEGO\Marcador de Tela" rmdir /S /Q "%APPDATA%\PELEGO\Marcador de Tela" >nul 2>&1

echo [7/7] Limpando temporarios conhecidos do Marcador...
del /Q "%TEMP%\pelego_marker*" >nul 2>&1
del /Q "%TEMP%\PelegoMarker*" >nul 2>&1
for /D %%D in ("%TEMP%\pelego_marker*") do rmdir /S /Q "%%~D" >nul 2>&1

cls
color 0A
echo ============================================================
echo          PELEGO MARCADOR REMOVIDO COMPLETAMENTE
echo ============================================================
echo.
echo O PELEGO Marcador de Tela foi removido.
echo O PELEGO RADIO NAO FOI ALTERADO.
echo.
echo Se ainda aparecer a entrada do Marcador em
echo Configuracoes ^> Aplicativos, feche e abra essa tela novamente.
echo.
pause
exit /b 0
