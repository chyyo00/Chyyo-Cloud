@echo off
chcp 65001 >nul
cd /d %~dp0
echo.
echo  ============================================
echo   Chyyo-Agent 시작 스크립트
echo  ============================================
echo.

where java >nul 2>nul
if %errorlevel% neq 0 (
    echo [오류] Java(JRE/JDK) 17 이상이 필요합니다.
    echo 설치: https://adoptium.net/temurin/
    pause
    exit /b 1
)

if not exist "build\libs\Chyyo-Agent-1.0.0-all.jar" (
    echo [1/2] 실행 파일(fat jar) 빌드 중...
    if exist "gradlew.bat" (
        call gradlew.bat fatJar
    ) else (
        call gradle fatJar
    )
    if %errorlevel% neq 0 (
        echo [오류] 빌드 실패.
        pause
        exit /b 1
    )
)

echo [2/2] Chyyo-Agent 기동...
echo  - 설정 파일: config.json  (Panel 주소 / Agent 토큰 입력)
echo  - 중지: Ctrl+C
echo.
java -jar "build\libs\Chyyo-Agent-1.0.0-all.jar"
pause
