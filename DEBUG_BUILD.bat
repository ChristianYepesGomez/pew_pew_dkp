@echo off
echo ========================================
echo    Backend Debug Build
echo ========================================
echo.

echo [1/6] Stopping and removing container...
docker stop dkp-backend 2>nul
docker rm -f dkp-backend 2>nul

echo.
echo [2/6] Removing all backend images...
docker rmi -f dkp-backend-backend 2>nul
docker rmi -f dkp-backend_backend 2>nul
FOR /F "tokens=*" %%i IN ('docker images -q --filter "reference=*backend*"') DO docker rmi -f %%i 2>nul

echo.
echo [3/6] Removing volume (will reset database)...
docker volume rm dkp-backend_dkp-data 2>nul
docker volume rm dkp-data 2>nul

echo.
echo [4/6] Pruning build cache...
docker builder prune -af --force

echo.
echo [5/6] Verifying database.js contains new version string...
findstr /C:"BUILD v2.0" database.js
if errorlevel 1 (
    echo ERROR: database.js does not contain BUILD v2.0 marker!
    pause
    exit /b 1
)
echo Found version marker in source code.

echo.
echo [6/6] Building with DOCKER_BUILDKIT disabled...
set DOCKER_BUILDKIT=0
set COMPOSE_DOCKER_CLI_BUILD=0
docker-compose build --no-cache --pull 2>&1

echo.
echo ========================================
echo    Starting Container...
echo ========================================
docker-compose up -d

echo.
echo Waiting 5 seconds for container to start...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo    Container Logs:
echo ========================================
docker logs dkp-backend

echo.
echo ========================================
echo    Container Status:
echo ========================================
docker ps -a --filter name=dkp-backend

echo.
echo If you see errors above, the build is still using cached code.
echo Try restarting Docker Desktop completely and run again.
echo.
pause
