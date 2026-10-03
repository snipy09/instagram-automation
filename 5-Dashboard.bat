@echo off
setlocal
cd /d "%~dp0"
echo ===========================================
echo INSTAGRAM AI AUTOPILOT - DASHBOARD
echo ===========================================
echo Dashboard: http://localhost:3456/api/status
echo ===========================================
call npm run build
if errorlevel 1 goto :error
start "" "http://localhost:3456/api/status"
node dist\dashboard\standalone.js
pause
exit /b
:error
echo Build failed. See the error above.
pause
exit /b 1
