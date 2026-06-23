#!/bin/bash

# ============================================
# FULL BACKUP SCRIPT FOR BLOKNOT PROJECT
# ============================================
# Version: 1.0
# Created: 2026-05-08
# ============================================

# Configuration
PROJECT_DIR="/var/www/bloknot-backend"
BACKUP_DIR="/var/backups/bloknot"
S3_BUCKET="bloknot-storage-1775930209"
DEPLOY_NUMBER=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="bloknot-backup-${DEPLOY_NUMBER}"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}
mkdir -p ${BACKUP_DIR}/temp

echo "=========================================="
echo "STARTING FULL BACKUP - DEPLOY #${DEPLOY_NUMBER}"
echo "=========================================="
echo "Backup directory: ${BACKUP_DIR}"
echo "Project directory: ${PROJECT_DIR}"
echo "=========================================="

# ============================================
# STEP 1: Backup PostgreSQL Database
# ============================================
echo "[1/5] Backing up PostgreSQL database..."
DB_NAME="bloknot"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Get database credentials from .env
if [ -f "${PROJECT_DIR}/.env" ]; then
    source ${PROJECT_DIR}/.env
fi

# Database backup
pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} > ${BACKUP_DIR}/temp/database-${DEPLOY_NUMBER}.sql 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✓ Database backup successful"
else
    echo "✗ Database backup failed"
    exit 1
fi

# ============================================
# STEP 2: Backup Project Files
# ============================================
echo "[2/5] Backing up project files..."
cd /var/www
tar -czf ${BACKUP_DIR}/temp/bloknot-backend-${DEPLOY_NUMBER}.tar.gz bloknot-backend/

if [ $? -eq 0 ]; then
    echo "✓ Project files backup successful"
else
    echo "✗ Project files backup failed"
    exit 1
fi

# ============================================
# STEP 3: Backup PM2 Configuration
# ============================================
echo "[3/5] Backing up PM2 configuration..."
pm2 save > ${BACKUP_DIR}/temp/pm2-dump-${DEPLOY_NUMBER}.txt 2>/dev/null
cp ~/.pm2/ecosystem.config.js ${BACKUP_DIR}/temp/ 2>/dev/null || echo "No ecosystem.config.js found"

echo "✓ PM2 configuration backup successful"

# ============================================
# STEP 4: Backup Nginx Configuration
# ============================================
echo "[4/5] Backing up Nginx configuration..."
mkdir -p ${BACKUP_DIR}/temp/nginx
cp /etc/nginx/sites-available/bloknotservis.ru ${BACKUP_DIR}/temp/nginx/ 2>/dev/null || echo "No nginx config found"
cp /etc/nginx/sites-available/bloknotservis.ru-ssl ${BACKUP_DIR}/temp/nginx/ 2>/dev/null || echo "No nginx SSL config found"

echo "✓ Nginx configuration backup successful"

# ============================================
# STEP 5: Create Final Archive
# ============================================
echo "[5/5] Creating final archive..."
cd ${BACKUP_DIR}/temp
tar -czf ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz database-${DEPLOY_NUMBER}.sql bloknot-backend-${DEPLOY_NUMBER}.tar.gz pm2-dump-${DEPLOY_NUMBER}.txt ecosystem.config.js nginx/

if [ $? -eq 0 ]; then
    echo "✓ Final archive created successfully"
else
    echo "✗ Final archive creation failed"
    exit 1
fi

# Cleanup temp files
rm -rf ${BACKUP_DIR}/temp

# ============================================
# STEP 6: Upload to S3 (Optional)
# ============================================
echo ""
echo "=========================================="
echo "UPLOADING TO S3..."
echo "=========================================="

if command -v aws &> /dev/null; then
    aws s3 cp ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz s3://${S3_BUCKET}/backups/
    
    if [ $? -eq 0 ]; then
        echo "✓ S3 upload successful"
    else
        echo "✗ S3 upload failed (continuing anyway)"
    fi
else
    echo "AWS CLI not installed, skipping S3 upload"
fi

# ============================================
# STEP 7: Create Restore Instructions
# ============================================
cat > ${BACKUP_DIR}/${BACKUP_NAME}-RESTORE.txt << 'EOF'
==========================================
BLOKNOT PROJECT BACKUP RESTORE INSTRUCTIONS
==========================================

DEPLOY NUMBER: ${DEPLOY_NUMBER}
BACKUP DATE: $(date)
BACKUP FILE: ${BACKUP_NAME}.tar.gz

==========================================
RESTORE STEPS
==========================================

1. EXTRACT BACKUP
------------------
   cd /var/backups/bloknot
   tar -xzf ${BACKUP_NAME}.tar.gz

2. RESTORE DATABASE
-------------------
   sudo -u postgres psql bloknot < database-${DEPLOY_NUMBER}.sql

3. RESTORE PROJECT FILES
------------------------
   cd /var/www
   rm -rf bloknot-backend
   tar -xzf /var/backups/bloknot/bloknot-backend-${DEPLOY_NUMBER}.tar.gz

4. RESTORE PM2 CONFIGURATION
-----------------------------
   pm2 resurrect
   pm2 save

5. RESTORE NGINX CONFIGURATION
-------------------------------
   sudo cp nginx/bloknotservis.ru /etc/nginx/sites-available/
   sudo cp nginx/bloknotservis.ru-ssl /etc/nginx/sites-available/
   sudo nginx -t
   sudo systemctl reload nginx

6. INSTALL DEPENDENCIES (if needed)
-----------------------------------
   cd /var/www/bloknot-backend
   npm install

7. RESTART SERVICES
-------------------
   pm2 restart bloknot
   sudo systemctl restart nginx

==========================================
VERIFICATION
==========================================

Check if services are running:
- pm2 status
- sudo systemctl status nginx
- sudo systemctl status postgresql

Test application:
- Open https://bloknotservis.ru
- Check login functionality
- Check database connections

==========================================
NOTES
==========================================

- This backup includes: database, project files, PM2 config, Nginx config
- Make sure PostgreSQL is running before restoring database
- Verify file permissions after restore
- Test all functionality after restore

==========================================
EOF

# ============================================
# SUMMARY
# ============================================
echo ""
echo "=========================================="
echo "BACKUP COMPLETED SUCCESSFULLY"
echo "=========================================="
echo "Deploy Number: ${DEPLOY_NUMBER}"
echo "Backup Location: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "Restore Instructions: ${BACKUP_DIR}/${BACKUP_NAME}-RESTORE.txt"
echo "Archive Size: $(du -h ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz | cut -f1)"
echo "=========================================="

# Keep only last 10 backups
echo ""
echo "Cleaning up old backups (keeping last 10)..."
ls -t ${BACKUP_DIR}/bloknot-backup-*.tar.gz | tail -n +11 | xargs rm -f 2>/dev/null
ls -t ${BACKUP_DIR}/bloknot-backup-*-RESTORE.txt | tail -n +11 | xargs rm -f 2>/dev/null

echo "Backup process completed!"
