#!/bin/bash
# Full backup of bloknot-backend project
# Run this on the production server

BACKUP_DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/var/backups/bloknot"
PROJECT_DIR="/var/www/bloknot-backend"

echo "Starting backup at $BACKUP_DATE"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# 1. Backup code (git)
echo "Backing up code..."
cd $PROJECT_DIR
git tag backup-$BACKUP_DATE
git push origin backup-$BACKUP_DATE
echo "Code backed up with git tag: backup-$BACKUP_DATE"

# 2. Backup database
echo "Backing up database..."
# Get database credentials from .env
DB_NAME=$(grep DATABASE_URL $PROJECT_DIR/.env | cut -d'/' -f4 | cut -d'?' -f1)
DB_USER=$(grep DATABASE_URL $PROJECT_DIR/.env | cut -d':' -f2 | cut -d'@' -f1)
DB_HOST=$(grep DATABASE_URL $PROJECT_DIR/.env | cut -d'@' -f2 | cut -d':' -f1)
DB_PORT=$(grep DATABASE_URL $PROJECT_DIR/.env | cut -d':' -f4 | cut -d'/' -f1)
DB_PASSWORD=$(grep DATABASE_URL $PROJECT_DIR/.env | cut -d':' -f3 | cut -d'@' -f1)

PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME > $BACKUP_DIR/database-$BACKUP_DATE.sql
gzip $BACKUP_DIR/database-$BACKUP_DATE.sql
echo "Database backed up to: $BACKUP_DIR/database-$BACKUP_DATE.sql.gz"

# 3. Backup environment variables
echo "Backing up environment variables..."
cp $PROJECT_DIR/.env $BACKUP_DIR/.env-$BACKUP_DATE
chmod 600 $BACKUP_DIR/.env-$BACKUP_DATE
echo "Environment variables backed up to: $BACKUP_DIR/.env-$BACKUP_DATE"

# 4. Backup uploaded files (if any)
if [ -d "$PROJECT_DIR/uploads" ]; then
    echo "Backing up uploaded files..."
    tar -czf $BACKUP_DIR/uploads-$BACKUP_DATE.tar.gz $PROJECT_DIR/uploads
    echo "Uploaded files backed up to: $BACKUP_DIR/uploads-$BACKUP_DATE.tar.gz"
fi

echo "Backup completed successfully!"
echo "Backup tag: backup-$BACKUP_DATE"
echo "Backup files location: $BACKUP_DIR"
