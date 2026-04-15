@echo off
setlocal enabledelayedexpansion

echo === CREATING FULL PROJECT BACKUP (WINDOWS) ===

REM Set variables
set BACKUP_DIR=C:\bloknot-backups
set DATE=%date:~-4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%
set BACKUP_NAME=bloknot-full-backup-%DATE%
set PROJECT_DIR=%~dp0

REM Create backup directory if it doesn't exist
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo Backup will be saved as: %BACKUP_NAME%

REM 1. Backup project code
echo 1. Backing up project code...
tar -czf "%BACKUP_DIR%\%BACKUP_NAME%-code.tar.gz" -C "%PROJECT_DIR%" --exclude=node_modules --exclude=.git --exclude=*.log --exclude=public\admin-custom-image* .

REM 2. Create backup info file
echo 2. Creating backup info...
echo === BLOKNOT FULL BACKUP INFO === > "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"
echo Backup Date: %date% %time% >> "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"
echo Backup Name: %BACKUP_NAME% >> "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"
echo Project Directory: %PROJECT_DIR% >> "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"
echo. >> "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"
echo === BACKUP CONTENTS === >> "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"
echo 1. %BACKUP_NAME%-code.tar.gz - Project source code ^(excluding node_modules^) >> "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"
echo 2. %BACKUP_NAME%-info.txt - This info file >> "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"
echo. >> "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"
echo === SIZE INFORMATION === >> "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"

REM Add file sizes to info
for %%f in ("%BACKUP_DIR%\%BACKUP_NAME%-*") do (
    echo %%f >> "%BACKUP_DIR%\%BACKUP_NAME%-info.txt"
)

REM 3. Create final combined backup
echo 3. Creating combined backup archive...
cd "%BACKUP_DIR%"
tar -czf "%BACKUP_NAME%-complete.tar.gz" %BACKUP_NAME%-*

echo.
echo === BACKUP COMPLETED SUCCESSFULLY ===
echo Combined backup: %BACKUP_DIR%\%BACKUP_NAME%-complete.tar.gz
echo Individual files in: %BACKUP_DIR%\
echo.
echo To restore: tar -xzf %BACKUP_NAME%-complete.tar.gz
echo.

pause
