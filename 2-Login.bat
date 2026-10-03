@echo off
setlocal
cd /d "%~dp0"
echo ===========================================
echo INSTAGRAM AI AUTOPILOT - LOGIN HELPER
echo ===========================================
echo A dedicated browser window will open.
echo 1. Log in to Instagram normally.
echo 2. Complete any verification in the browser.
echo 3. When your feed is visible, close the browser window.
echo ===========================================
call npm run login
pause
