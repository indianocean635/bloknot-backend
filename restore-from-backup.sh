#!/bin/bash

# RESTORE PROJECT FROM BACKUP SCRIPT
# This script restores the Bloknot project from a backup

echo "=== RESTORING PROJECT FROM BACKUP ==="

# Check if backup file provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    echo "Example: $0 /var/www/backups/bloknot-full-backup-20240415_190000-complete.tar.gz"
    exit 1
fi

BACKUP_FILE="$1"
RESTORE_DIR="/tmp/bloknot-restore-$(date +%s)"
PROJECT_DIR="/var/www/bloknot-backend"

echo "Backup file: $BACKUP_FILE"
echo "Restore directory: $RESTORE_DIR"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Create restore directory
mkdir -p "$RESTORE_DIR"

# Extract backup
echo "1. Extracting backup..."
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to extract backup"
    rm -rf "$RESTORE_DIR"
    exit 1
fi

# Find backup files
CODE_BACKUP=$(find "$RESTORE_DIR" -name "*-code.tar.gz" | head -1)
DB_BACKUP=$(find "$RESTORE_DIR" -name "*-database.sql.gz" | head -1)
STATIC_BACKUP=$(find "$RESTORE_DIR" -name "*-static.tar.gz" | head -1)
ECOSYSTEM_BACKUP=$(find "$RESTORE_DIR" -name "*-ecosystem.config.js" | head -1)

if [ -z "$CODE_BACKUP" ] || [ -z "$DB_BACKUP" ] || [ -z "$STATIC_BACKUP" ]; then
    echo "ERROR: Required backup files not found"
    ls -la "$RESTORE_DIR"
    rm -rf "$RESTORE_DIR"
    exit 1
fi

echo "Found backup files:"
echo "  Code: $CODE_BACKUP"
echo "  Database: $DB_BACKUP"
echo "  Static: $STATIC_BACKUP"
if [ -n "$ECOSYSTEM_BACKUP" ]; then
    echo "  Ecosystem: $ECOSYSTEM_BACKUP"
fi

# Stop application
echo "2. Stopping application..."
pm2 stop bloknot

# Backup current installation
echo "3. Backing up current installation..."
CURRENT_BACKUP_DIR="/var/www/bloknot-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$CURRENT_BACKUP_DIR"
cp -r "$PROJECT_DIR" "$CURRENT_BACKUP_DIR/"
cp -r "/var/www/html" "$CURRENT_BACKUP_DIR/"

# Restore project code
echo "4. Restoring project code..."
rm -rf "$PROJECT_DIR"/*
tar -xzf "$CODE_BACKUP" -C "$PROJECT_DIR"

# Install dependencies
echo "5. Installing dependencies..."
cd "$PROJECT_DIR"
npm ci

# Restore database
echo "6. Restoring database..."
gunzip -c "$DB_BACKUP" > /tmp/restore_db.sql

# Get database credentials
if [ -f .env ]; then
    DB_NAME=$(grep DATABASE_URL .env | sed 's/.*\/\([^?]*\).*/\1/')
    DB_USER=$(grep DATABASE_URL .env | sed 's/.*:\/\/\([^:]*\):.*/\1/')
    DB_PASS=$(grep DATABASE_URL .env | sed 's/.*:\([^@]*\)@.*/\1/')
    DB_HOST=$(grep DATABASE_URL .env | sed 's/.*@\([^:]*\):.*/\1/')
    DB_PORT=$(grep DATABASE_URL .env | sed 's/.*:\([0-9]*\)\/.*/\1/')
    
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < /tmp/restore_db.sql
    
    if [ $? -eq 0 ]; then
        echo "Database restored successfully"
    else
        echo "WARNING: Database restore failed - you may need to restore manually"
    fi
else
    echo "WARNING: .env file not found - cannot restore database automatically"
fi

rm -f /tmp/restore_db.sql

# Restore static files
echo "7. Restoring static files..."
rm -rf /var/www/html/*
tar -xzf "$STATIC_BACKUP" -C /var/www/html

# Restore PM2 configuration if available
if [ -n "$ECOSYSTEM_BACKUP" ]; then
    echo "8. Restoring PM2 configuration..."
    cp "$ECOSYSTEM_BACKUP" "$PROJECT_DIR/ecosystem.config.js"
fi

# Generate Prisma client
echo "9. Generating Prisma client..."
cd "$PROJECT_DIR"
npx prisma generate

# Start application
echo "10. Starting application..."
pm2 start ecosystem.config.js

# Wait a moment for startup
sleep 3

# Check status
echo "11. Checking application status..."
pm2 status

# Clean up
rm -rf "$RESTORE_DIR"

echo ""
echo "=== RESTORE COMPLETED ==="
echo "Current installation backed up to: $CURRENT_BACKUP_DIR"
echo "Application should be running at: http://bloknotservis.ru"
echo ""
echo "If anything went wrong, you can restore from: $CURRENT_BACKUP_DIR"
echo ""
