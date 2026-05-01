#!/bin/bash
# Rollback bloknot-backend to backup from 2026-05-01
# Run this on the production server

BACKUP_DATE="2026-05-01"
BACKUP_DIR="/var/backups/bloknot"
PROJECT_DIR="/var/www/bloknot-backend"

echo "Starting rollback to $BACKUP_DATE backup"

# 1. Stop the application
echo "Stopping application..."
pm2 stop bloknot

# 2. Rollback code using git
echo "Rolling back code..."
cd $PROJECT_DIR
git fetch origin
git checkout backup-$BACKUP_DATE-$1
echo "Code rolled back to git tag: backup-$BACKUP_DATE-$1"

# 3. Restore database
echo "Restoring database..."
DB_NAME=$(grep DATABASE_URL $PROJECT_DIR/.env | cut -d'/' -f4 | cut -d'?' -f1)
DB_USER=$(grep DATABASE_URL $PROJECT_DIR/.env | cut -d':' -f2 | cut -d'@' -f1)
DB_HOST=$(grep DATABASE_URL $PROJECT_DIR/.env | cut -d'@' -f2 | cut -d':' -f1)
DB_PORT=$(grep DATABASE_URL $PROJECT_DIR/.env | cut -d':' -f4 | cut -d'/' -f1)
DB_PASSWORD=$(grep DATABASE_URL $PROJECT_DIR/.env | cut -d':' -f3 | cut -d'@' -f1)

gunzip -c $BACKUP_DIR/database-$BACKUP_DATE-$1.sql.gz | PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
echo "Database restored from: $BACKUP_DIR/database-$BACKUP_DATE-$1.sql.gz"

# 4. Restore uploaded files (if backup exists)
if [ -f "$BACKUP_DIR/uploads-$BACKUP_DATE-$1.tar.gz" ]; then
    echo "Restoring uploaded files..."
    rm -rf $PROJECT_DIR/uploads
    tar -xzf $BACKUP_DIR/uploads-$BACKUP_DATE-$1.tar.gz -C $PROJECT_DIR
    echo "Uploaded files restored from: $BACKUP_DIR/uploads-$BACKUP_DATE-$1.tar.gz"
fi

# 5. Restart the application
echo "Restarting application..."
pm2 restart bloknot

echo "Rollback completed successfully!"
echo "Rolled back to: backup-$BACKUP_DATE-$1"
