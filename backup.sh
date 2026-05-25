#!/bin/bash

# Backup script for bloknot-backend
# Usage: ./backup.sh
# This script backs up the database, project files, and configuration

# Configuration
BACKUP_DIR="/var/www/backups/bloknot"
PROJECT_DIR="/var/www/bloknot-backend"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="bloknot_backup_${DATE}"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "========================================"
echo "Starting backup: $BACKUP_NAME"
echo "========================================"

# 1. Backup PostgreSQL database
echo "[1/5] Backing up PostgreSQL database..."
if [ -f "$PROJECT_DIR/.env" ]; then
    # Load DATABASE_URL from .env
    source "$PROJECT_DIR/.env"
    
    if [ -n "$DATABASE_URL" ]; then
        pg_dump "$DATABASE_URL" > "$BACKUP_DIR/${BACKUP_NAME}_database.sql"
        if [ $? -eq 0 ]; then
            echo "✅ Database backup completed"
        else
            echo "❌ Database backup failed"
            exit 1
        fi
    else
        echo "❌ DATABASE_URL not found in .env"
        exit 1
    fi
else
    echo "❌ .env file not found"
    exit 1
fi

# 2. Backup project files (excluding node_modules and logs)
echo "[2/5] Backing up project files..."
cd "$PROJECT_DIR"
tar -czf "$BACKUP_DIR/${BACKUP_NAME}_project.tar.gz" \
    --exclude='node_modules' \
    --exclude='logs' \
    --exclude='.git' \
    --exclude='*.log' \
    .

if [ $? -eq 0 ]; then
    echo "✅ Project files backup completed"
else
    echo "❌ Project files backup failed"
    exit 1
fi

# 3. Backup .env file separately
echo "[3/5] Backing up .env file..."
cp "$PROJECT_DIR/.env" "$BACKUP_DIR/${BACKUP_NAME}_env.txt"
if [ $? -eq 0 ]; then
    echo "✅ .env backup completed"
else
    echo "❌ .env backup failed"
    exit 1
fi

# 4. Backup PM2 configuration
echo "[4/5] Backing up PM2 configuration..."
pm2 save --force
cp "$HOME/.pm2/dump.pm2" "$BACKUP_DIR/${BACKUP_NAME}_pm2_dump.pm2"
pm2 list > "$BACKUP_DIR/${BACKUP_NAME}_pm2_list.txt"
if [ $? -eq 0 ]; then
    echo "✅ PM2 configuration backup completed"
else
    echo "❌ PM2 configuration backup failed"
    exit 1
fi

# 5. Create combined backup archive
echo "[5/5] Creating combined backup archive..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}_full.tar.gz" \
    "${BACKUP_NAME}_database.sql" \
    "${BACKUP_NAME}_project.tar.gz" \
    "${BACKUP_NAME}_env.txt" \
    "${BACKUP_NAME}_pm2_dump.pm2" \
    "${BACKUP_NAME}_pm2_list.txt"

if [ $? -eq 0 ]; then
    echo "✅ Combined backup archive created"
else
    echo "❌ Combined backup archive creation failed"
    exit 1
fi

# Remove individual files after creating combined archive
rm -f \
    "${BACKUP_NAME}_database.sql" \
    "${BACKUP_NAME}_project.tar.gz" \
    "${BACKUP_NAME}_env.txt" \
    "${BACKUP_NAME}_pm2_dump.pm2" \
    "${BACKUP_NAME}_pm2_list.txt"

# Clean up old backups (keep last RETENTION_DAYS days)
echo "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "bloknot_backup_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete

# Show backup size
BACKUP_SIZE=$(du -h "${BACKUP_NAME}_full.tar.gz" | cut -f1)
echo "========================================"
echo "✅ Backup completed successfully!"
echo "Backup file: ${BACKUP_DIR}/${BACKUP_NAME}_full.tar.gz"
echo "Backup size: $BACKUP_SIZE"
echo "========================================"
