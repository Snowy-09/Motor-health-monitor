@echo off
color 0B
echo ===================================================
echo MOTOR-HEALTH-MONITOR
echo ===================================================
echo.

echo [1/2] Checking Hardware Dependencies...
cd backend
pip install -r requirements.txt >nul 2>&1

echo [2/2] Igniting Hardware Link...
start "Python Backend" cmd /c "uvicorn main:app --host 0.0.0.0 --port 8000"

:: Wait 3 seconds to ensure the server is fully awake
timeout /t 3 /nobreak >nul

:: OPEN YOUR LIVE VERCEL WEBSITE
start https://motor-health-monitor.vercel.app

echo.
echo ✅ HARDWARE BRIDGE ACTIVE! 
echo The Arduino is now streaming data to the cloud.
pause >nul