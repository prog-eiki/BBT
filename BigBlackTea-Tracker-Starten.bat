@echo off
chcp 65001 >nul
title BigBlackTea [BBT] - PREMIER TEAM HQ
cd /d "%~dp0"

echo ========================================================
echo   BigBlackTea [BBT] - PREMIER TEAM HQ
echo   Strategie. Teamwork. Erfolg.
echo ========================================================
echo.
echo Starte lokalen BBT HQ Server auf http://localhost:3000 ...
echo (Dieses Fenster geoeffnet lassen, solange du die Website nutzt)
echo.

REM Oeffne den Browser automatisch nach 3 Sekunden
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

REM Starte den Produktionsserver (oder Dev-Server als Fallback)
if exist ".next\BUILD_ID" (
    call npm.cmd run start
) else (
    call npm.cmd run dev
)
pause
