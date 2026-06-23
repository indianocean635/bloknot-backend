#!/bin/bash

# FULL PROJECT BACKUP SCRIPT
# This script creates a complete backup of the Bloknot project

echo "=== CREATING FULL PROJECT BACKUP ==="

# Set variables
BACKUP_DIR="/var/www/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="bloknot-full-backup-$DATE"
PROJECT_DIR="/var/www/bloknot-backend"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "Backup will be saved as: $BACKUP_NAME"

# 1. Backup project code
echo "1. Backing up project code..."
tar -czf "$BACKUP_DIR/$BACKUP_NAME-code.tar.gz" -C "$PROJECT_DIR" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=*.log \
    --exclude=public/admin-custom-image* \
    .

# 2. Backup database
echo "2. Backing up PostgreSQL database..."
cd "$PROJECT_DIR"

# Get database credentials from .env file
if [ -f .env ]; then
    DB_NAME=$(grep DATABASE_URL .env | sed 's/.*\/\([^?]*\).*/\1/')
    DB_USER=$(grep DATABASE_URL .env | sed 's/.*:\/\/\([^:]*\):.*/\1/')
    DB_PASS=$(grep DATABASE_URL .env | sed 's/.*:\([^@]*\)@.*/\1/')
    DB_HOST=$(grep DATABASE_URL .env | sed 's/.*@\([^:]*\):.*/\1/')
    DB_PORT=$(grep DATABASE_URL .env | sed 's/.*:\([0-9]*\)\/.*/\1/')
else
    echo "ERROR: .env file not found"
    exit 1
fi

# Create database backup
PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_DIR/$BACKUP_NAME-database.sql"

if [ $? -eq 0 ]; then
    echo "Database backup successful"
    gzip "$BACKUP_DIR/$BACKUP_NAME-database.sql"
else
    echo "ERROR: Database backup failed"
fi

# 3. Backup static files and uploads
echo "3. Backing up static files..."
tar -czf "$BACKUP_DIR/$BACKUP_NAME-static.tar.gz" -C "/var/www/html" .

# 4. Backup PM2 configuration and logs
echo "4. Backing up PM2 configuration..."
cp "$PROJECT_DIR/ecosystem.config.js" "$BACKUP_DIR/$BACKUP_NAME-ecosystem.config.js"
pm2 logs > "$BACKUP_DIR/$BACKUP_NAME-pm2-logs.txt" 2>&1

# 5. Create backup info file
echo "5. Creating backup info..."
cat > "$BACKUP_DIR/$BACKUP_NAME-info.txt" << EOF
=== BLOKNOT FULL BACKUP INFO ===
Backup Date: $(date)
Backup Name: $BACKUP_NAME
Project Directory: $PROJECT_DIR
Git Commit: $(cd $PROJECT_DIR && git rev-parse HEAD)
Git Branch: $(cd $PROJECT_DIR && git branch --show-current)
Node Version: $(node --version)
PM2 Status: $(pm2 status | grep bloknot | head -5)

=== BACKUP CONTENTS ===
1. $BACKUP_NAME-code.tar.gz - Project source code (excluding node_modules)
2. $BACKUP_NAME-database.sql.gz - PostgreSQL database dump
3. $BACKUP_NAME-static.tar.gz - Static files from /var/www/html
4. $BACKUP_NAME-ecosystem.config.js - PM2 configuration
5. $BACKUP_NAME-pm2-logs.txt - PM2 application logs
6. $BACKUP_NAME-info.txt - This info file

=== RESTORATION INSTRUCTIONS ===
1. Extract code backup: tar -xzf $BACKUP_NAME-code.tar.gz
2. Restore database: gunzip $BACKUP_NAME-database.sql.gz && psql -d dbname < $BACKUP_NAME-database.sql
3. Restore static files: tar -xzf $BACKUP_NAME-static.tar.gz -C /var/www/html
4. Copy PM2 config: cp $BACKUP_NAME-ecosystem.config.js ecosystem.config.js
5. Install dependencies: npm ci
6. Restart application: pm2 restart bloknot

=== SIZE INFORMATION ===
EOF

# Add file sizes to info
ls -lh "$BACKUP_DIR/$BACKUP_NAME-"* >> "$BACKUP_DIR/$BACKUP_NAME-info.txt"

# 6. Create final combined backup
echo "6. Creating combined backup archive..."
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME-complete.tar.gz" $BACKUP_NAME-*

# 7. Clean up individual files (optional - comment out if you want to keep them)
# rm $BACKUP_NAME-code.tar.gz $BACKUP_NAME-database.sql.gz $BACKUP_NAME-static.tar.gz

echo ""
echo "=== BACKUP COMPLETED SUCCESSFULLY ==="
echo "Combined backup: $BACKUP_DIR/$BACKUP_NAME-complete.tar.gz"
echo "Individual files in: $BACKUP_DIR/"
echo ""
echo "Backup size: $(du -h "$BACKUP_DIR/$BACKUP_NAME-complete.tar.gz" | cut -f1)"
echo "Total backup size: $(du -sh "$BACKUP_DIR/$BACKUP_NAME-"* | tail -1 | cut -f1)"
echo ""
echo "To restore: tar -xzf $BACKUP_NAME-complete.tar.gz"
echo ""
