#!/bin/bash

# Restore script for bloknot-backend
# Usage: ./restore.sh <backup_file>
# Example: ./restore.sh /var/www/backups/bloknot/bloknot_backup_20260525_183000_full.tar.gz

if [ -z "$1" ]; then
    echo "❌ Error: Backup file path required"
    echo "Usage: ./restore.sh <backup_file>"
    echo "Example: ./restore.sh /var/www/backups/bloknot/bloknot_backup_20260525_183000_full.tar.gz"
    exit 1
fi

BACKUP_FILE="$1"
BACKUP_DIR="/var/www/backups/bloknot"
PROJECT_DIR="/var/www/bloknot-backend"
TEMP_DIR="/tmp/bloknot_restore_$(date +%s)"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "========================================"
echo "Starting restore from: $BACKUP_FILE"
echo "========================================"

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Extract backup archive
echo "[1/6] Extracting backup archive..."
cd "$TEMP_DIR"
tar -xzf "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo "❌ Failed to extract backup archive"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "✅ Backup archive extracted"

# Find the extracted files
BACKUP_NAME=$(ls -t *.tar.gz 2>/dev/null | head -1 | sed 's/_full.tar.gz//')
if [ -z "$BACKUP_NAME" ]; then
    echo "❌ Could not determine backup name"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "Backup name: $BACKUP_NAME"

# Stop PM2 processes
echo "[2/6] Stopping PM2 processes..."
pm2 stop all
if [ $? -eq 0 ]; then
    echo "✅ PM2 processes stopped"
else
    echo "⚠️  Warning: Failed to stop PM2 processes"
fi

# Backup current state before restore
echo "[3/6] Creating safety backup of current state..."
CURRENT_BACKUP="pre_restore_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR/safety_backups"
cp "$PROJECT_DIR/.env" "$BACKUP_DIR/safety_backups/${CURRENT_BACKUP}_env.txt" 2>/dev/null
pm2 save --force
cp "$HOME/.pm2/dump.pm2" "$BACKUP_DIR/safety_backups/${CURRENT_BACKUP}_pm2_dump.pm2" 2>/dev/null
echo "✅ Safety backup created: $CURRENT_BACKUP"

# Restore .env file
echo "[4/6] Restoring .env file..."
if [ -f "${BACKUP_NAME}_env.txt" ]; then
    cp "${BACKUP_NAME}_env.txt" "$PROJECT_DIR/.env"
    echo "✅ .env file restored"
else
    echo "⚠️  Warning: .env backup not found, keeping current .env"
fi

# Restore project files
echo "[5/6] Restoring project files..."
if [ -f "${BACKUP_NAME}_project.tar.gz" ]; then
    cd "$PROJECT_DIR"
    # Remove old files (except node_modules)
    find . -mindepth 1 -not -path './node_modules/*' -not -path './.git/*' -delete
    # Extract project files
    tar -xzf "$TEMP_DIR/${BACKUP_NAME}_project.tar.gz"
    echo "✅ Project files restored"
else
    echo "⚠️  Warning: Project files backup not found"
fi

# Restore database
echo "[6/6] Restoring PostgreSQL database..."
if [ -f "${BACKUP_NAME}_database.sql" ]; then
    # Load DATABASE_URL from restored .env
    source "$PROJECT_DIR/.env"
    
    if [ -n "$DATABASE_URL" ]; then
        psql "$DATABASE_URL" < "$TEMP_DIR/${BACKUP_NAME}_database.sql"
        if [ $? -eq 0 ]; then
            echo "✅ Database restored"
        else
            echo "❌ Database restore failed"
            echo "⚠️  Project files and .env have been restored, but database needs manual restore"
            rm -rf "$TEMP_DIR"
            exit 1
        fi
    else
        echo "❌ DATABASE_URL not found in restored .env"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
else
    echo "⚠️  Warning: Database backup not found"
fi

# Restore PM2 configuration
echo "Restoring PM2 configuration..."
if [ -f "${BACKUP_NAME}_pm2_dump.pm2" ]; then
    cp "${BACKUP_NAME}_pm2_dump.pm2" "$HOME/.pm2/dump.pm2"
    pm2 resurrect
    echo "✅ PM2 configuration restored"
else
    echo "⚠️  Warning: PM2 configuration backup not found"
    echo "Starting PM2 with current ecosystem.config.js..."
    cd "$PROJECT_DIR"
    pm2 start ecosystem.config.js
fi

# Install dependencies if needed
echo "Installing dependencies..."
cd "$PROJECT_DIR"
npm install
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed"
else
    echo "⚠️  Warning: Some dependencies may have failed to install"
fi

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy
if [ $? -eq 0 ]; then
    echo "✅ Prisma migrations completed"
else
    echo "⚠️  Warning: Prisma migrations may have issues"
fi

# Save PM2 state
pm2 save --force

# Clean up temporary directory
rm -rf "$TEMP_DIR"

echo "========================================"
echo "✅ Restore completed successfully!"
echo "========================================"
echo "Next steps:"
echo "1. Check PM2 status: pm2 status"
echo "2. Check logs: pm2 logs"
echo "3. Verify application is working"
echo "========================================"
