@echo off
setlocal
cd /d "%~dp0"
echo ===========================================
echo INSTAGRAM AI AUTOPILOT - STARTING BOT
echo ===========================================
echo The bot will run in this window. Press CTRL+C to stop it.
echo ===========================================
call npm run build
if errorlevel 1 goto :error
node dist\index.js
pause
exit /b
:error
echo Build failed. See the error above.
pause
exit /b 1
