@echo off
REM QueueCTL Test Scenarios - Windows CMD Version
REM This script automatically detects its location and adjusts paths

REM Save original directory
set ORIGINAL_DIR=%CD%

REM Get the script's directory
set SCRIPT_DIR=%~dp0

REM Go to project root (one level up from tests/)
cd /d "%SCRIPT_DIR%.."

echo ==========================================
echo QueueCTL Test Scenarios (Windows CMD)
echo ==========================================
echo.
echo Running from: %CD%
echo.

echo === Test 1: Enqueue Simple Job ===
node src\cli\index.js enqueue "{\"command\":\"echo Hello World\",\"max_retries\":3}"
echo.

echo === Test 2: Enqueue Job with Timeout ===
node src\cli\index.js enqueue "{\"command\":\"timeout /t 2 ^>nul ^&^& echo Done\",\"max_retries\":3}"
echo.

echo === Test 3: Enqueue Failing Job ===
node src\cli\index.js enqueue "{\"command\":\"exit 1\",\"max_retries\":2}"
echo.

echo === Test 4: Enqueue Invalid Command ===
node src\cli\index.js enqueue "{\"command\":\"nonexistentcommand123\",\"max_retries\":2}"
echo.

echo === Test 5: Check Status ===
node src\cli\index.js status
echo.

echo === Test 6: List All Jobs ===
node src\cli\index.js list
echo.

echo === Test 7: List Pending Jobs ===
node src\cli\index.js list --state pending
echo.

echo === Test 8: View Configuration ===
node src\cli\index.js config get
echo.

echo === Test 9: Update Configuration ===
node src\cli\index.js config set max-retries 5
echo.

echo === Test 10: Verify Configuration ===
node src\cli\index.js config get max-retries
echo.

echo.
echo ==========================================
echo Manual Worker Test Required
echo ==========================================
echo.
echo Please follow these steps:
echo 1. Open a NEW command prompt window
echo 2. Navigate to: %CD%
echo 3. Run: node src\cli\index.js worker start --count 2
echo 4. Wait 15-20 seconds
echo 5. Press Ctrl+C to stop workers
echo 6. Come back to this window and press any key to continue
echo.
pause

echo.
echo === Test 11: Check Status After Processing ===
node src\cli\index.js status
echo.

echo === Test 12: List Completed Jobs ===
node src\cli\index.js list --state completed
echo.

echo === Test 13: Check Dead Letter Queue ===
node src\cli\index.js dlq list
echo.

echo === Test 14: Final Status Check ===
node src\cli\index.js status
echo.

echo ==========================================
echo Test Complete!
echo ==========================================
echo.
echo Manual verification checklist:
echo [ ] Jobs were enqueued successfully
echo [ ] Status shows correct job counts
echo [ ] Workers processed jobs
echo [ ] Some jobs completed
echo [ ] Some jobs moved to DLQ
echo [ ] Configuration was updated
echo.

REM Return to original directory
cd /d "%ORIGINAL_DIR%"

pause