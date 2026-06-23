#!/bin/bash

# FULL PROJECT BACKUP SCRIPT
# Creates complete backup of Bloknot project
# Execute on server: bash full-project-backup.sh

echo "=========================================="
echo "FULL BLOKNOT PROJECT BACKUP"
echo "=========================================="

# Get current timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/bloknot"
BACKUP_NAME="bloknot_full_backup_${TIMESTAMP}"

echo "Backup timestamp: ${TIMESTAMP}"
echo "Backup directory: ${BACKUP_DIR}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

echo ""
echo "1. Backing up application files..."

# Backup application code
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_code.tar.gz" \
    /var/www/bloknot-backend \
    --exclude=node_modules \
    --exclude=uploads \
    --exclude=.git

echo "   Code backup created: ${BACKUP_NAME}_code.tar.gz"

echo ""
echo "2. Backing up user uploads..."

# Backup user uploads (avatars, works, etc.)
if [ -d "/var/www/bloknot-backend/uploads" ]; then
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_uploads.tar.gz" \
        /var/www/bloknot-backend/uploads
    
    echo "   Uploads backup created: ${BACKUP_NAME}_uploads.tar.gz"
else
    echo "   No uploads directory found"
fi

echo ""
echo "3. Backing up Nginx configuration..."

# Backup Nginx config
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_nginx.tar.gz" \
    /etc/nginx/sites-enabled/bloknotservis.ru \
    /etc/nginx/sites-available/bloknotservis.ru

echo "   Nginx backup created: ${BACKUP_NAME}_nginx.tar.gz"

echo ""
echo "4. Backing up PM2 configuration..."

# Backup PM2 config
cp /var/www/bloknot-backend/ecosystem.config.js "${BACKUP_DIR}/${BACKUP_NAME}_pm2.js"

# Backup PM2 current process list
pm2 save
cp /home/root/.pm2/dump.pm2 "${BACKUP_DIR}/${BACKUP_NAME}_pm2_dump.pm2"

echo "   PM2 backup created"

echo ""
echo "5. Backing up SSL certificates..."

# Backup SSL certificates
if [ -d "/etc/letsencrypt/live/bloknotservis.ru" ]; then
    tar -czf "${BACKUP_DIR}/${BACKUP_NAME}_ssl.tar.gz" \
        /etc/letsencrypt/live/bloknotservis.ru \
        /etc/letsencrypt/archive/bloknotservis.ru
    
    echo "   SSL backup created: ${BACKUP_NAME}_ssl.tar.gz"
else
    echo "   No SSL certificates found"
fi

echo ""
echo "6. Backing up database (if any)..."

# Check for database files
if [ -f "/var/www/bloknot-backend/database.db" ]; then
    cp /var/www/bloknot-backend/database.db "${BACKUP_DIR}/${BACKUP_NAME}_database.db"
    echo "   Database backup created: ${BACKUP_NAME}_database.db"
elif [ -f "/var/www/bloknot-backend/prisma/dev.db" ]; then
    cp /var/www/bloknot-backend/prisma/dev.db "${BACKUP_DIR}/${BACKUP_NAME}_database.db"
    echo "   Database backup created: ${BACKUP_NAME}_database.db"
else
    echo "   No database file found"
fi

echo ""
echo "7. Creating restore script..."

# Create restore script
cat > "${BACKUP_DIR}/restore_${BACKUP_NAME}.sh" << 'EOF'
#!/bin/bash

# RESTORE SCRIPT FOR BLOKNOT PROJECT
# Execute: bash restore_*.sh

echo "=========================================="
echo "RESTORING BLOKNOT PROJECT"
echo "=========================================="

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_timestamp>"
    echo "Example: $0 20240407_213400"
    exit 1
fi

TIMESTAMP=$1
BACKUP_DIR="/var/backups/bloknot"
BACKUP_NAME="bloknot_full_backup_${TIMESTAMP}"

echo "Restoring from: ${BACKUP_NAME}"

# Stop services
echo ""
echo "1. Stopping services..."
pm2 stop bloknot
systemctl stop nginx

# Backup current state before restore
echo ""
echo "2. Creating safety backup of current state..."
CURRENT_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "${BACKUP_DIR}/before_restore_${CURRENT_TIMESTAMP}"
cp -r /var/www/bloknot-backend "${BACKUP_DIR}/before_restore_${CURRENT_TIMESTAMP}/"

# Restore application code
echo ""
echo "3. Restoring application code..."
if [ -f "${BACKUP_DIR}/${BACKUP_NAME}_code.tar.gz" ]; then
    tar -xzf "${BACKUP_DIR}/${BACKUP_NAME}_code.tar.gz" -C /
    echo "   Code restored"
else
    echo "   ERROR: Code backup not found"
fi

# Restore uploads
echo ""
echo "4. Restoring user uploads..."
if [ -f "${BACKUP_DIR}/${BACKUP_NAME}_uploads.tar.gz" ]; then
    tar -xzf "${BACKUP_DIR}/${BACKUP_NAME}_uploads.tar.gz" -C /
    echo "   Uploads restored"
else
    echo "   No uploads backup found"
fi

# Restore Nginx config
echo ""
echo "5. Restoring Nginx configuration..."
if [ -f "${BACKUP_DIR}/${BACKUP_NAME}_nginx.tar.gz" ]; then
    tar -xzf "${BACKUP_DIR}/${BACKUP_NAME}_nginx.tar.gz" -C /
    echo "   Nginx restored"
else
    echo "   No Nginx backup found"
fi

# Restore PM2 config
echo ""
echo "6. Restoring PM2 configuration..."
if [ -f "${BACKUP_DIR}/${BACKUP_NAME}_pm2.js" ]; then
    cp "${BACKUP_DIR}/${BACKUP_NAME}_pm2.js" /var/www/bloknot-backend/ecosystem.config.js
    echo "   PM2 config restored"
fi

if [ -f "${BACKUP_DIR}/${BACKUP_NAME}_pm2_dump.pm2" ]; then
    cp "${BACKUP_DIR}/${BACKUP_NAME}_pm2_dump.pm2" /home/root/.pm2/dump.pm2
    echo "   PM2 dump restored"
fi

# Restore SSL certificates
echo ""
echo "7. Restoring SSL certificates..."
if [ -f "${BACKUP_DIR}/${BACKUP_NAME}_ssl.tar.gz" ]; then
    tar -xzf "${BACKUP_DIR}/${BACKUP_NAME}_ssl.tar.gz" -C /
    echo "   SSL restored"
else
    echo "   No SSL backup found"
fi

# Restore database
echo ""
echo "8. Restoring database..."
if [ -f "${BACKUP_DIR}/${BACKUP_NAME}_database.db" ]; then
    cp "${BACKUP_DIR}/${BACKUP_NAME}_database.db" /var/www/bloknot-backend/database.db
    echo "   Database restored"
else
    echo "   No database backup found"
fi

# Set permissions
echo ""
echo "9. Setting permissions..."
chown -R root:root /var/www/bloknot-backend
chmod -R 755 /var/www/bloknot-backend

# Start services
echo ""
echo "10. Starting services..."
systemctl start nginx
pm2 start /var/www/bloknot-backend/ecosystem.config.js

# Verify services
echo ""
echo "11. Verifying services..."
sleep 3

echo "PM2 Status:"
pm2 status

echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager

echo ""
echo "=========================================="
echo "RESTORE COMPLETED"
echo "=========================================="
echo "Backup used: ${BACKUP_NAME}"
echo "Current backup of previous state: before_restore_${CURRENT_TIMESTAMP}"
echo ""
echo "Please verify that everything is working correctly."
echo "If there are issues, you can restore from the safety backup."
EOF

chmod +x "${BACKUP_DIR}/restore_${BACKUP_NAME}.sh"

echo "   Restore script created: restore_${BACKUP_NAME}.sh"

echo ""
echo "8. Creating backup summary..."

# Create backup summary
cat > "${BACKUP_DIR}/backup_summary_${BACKUP_NAME}.txt" << EOF
BLOKNOT PROJECT BACKUP SUMMARY
================================
Backup Name: ${BACKUP_NAME}
Timestamp: ${TIMESTAMP}
Created: $(date)

Files Created:
- ${BACKUP_NAME}_code.tar.gz (Application code)
- ${BACKUP_NAME}_uploads.tar.gz (User uploads)
- ${BACKUP_NAME}_nginx.tar.gz (Nginx configuration)
- ${BACKUP_NAME}_pm2.js (PM2 configuration)
- ${BACKUP_NAME}_pm2_dump.pm2 (PM2 process list)
- ${BACKUP_NAME}_ssl.tar.gz (SSL certificates)
- ${BACKUP_NAME}_database.db (Database)
- restore_${BACKUP_NAME}.sh (Restore script)
- backup_summary_${BACKUP_NAME}.txt (This summary)

What's Included:
- Complete application code
- User uploads (avatars, works, etc.)
- Nginx configuration
- PM2 configuration
- SSL certificates
- Database (if exists)
- All user data and settings

How to Restore:
1. bash restore_${BACKUP_NAME}.sh ${TIMESTAMP}

Services Running After Backup:
- PM2: $(pm2 list | grep bloknot | wc -l) processes
- Nginx: $(systemctl is-active nginx)
- SSL: $(test -d /etc/letsencrypt/live/bloknotservis.ru && echo "Active" || echo "Not found")

Total Backup Size:
$(du -sh ${BACKUP_DIR}/${BACKUP_NAME}_*.tar.gz ${BACKUP_DIR}/${BACKUP_NAME}_*.db ${BACKUP_DIR}/${BACKUP_NAME}_*.js 2>/dev/null | awk '{sum+=$1} END {print sum "B"}')
EOF

echo "   Backup summary created: backup_summary_${BACKUP_NAME}.txt"

echo ""
echo "9. Cleaning up old backups (keep last 5)..."

# Keep only last 5 backups
cd "${BACKUP_DIR}"
ls -1 bloknot_full_backup_*_code.tar.gz | sort -r | tail -n +6 | while read file; do
    BASENAME=$(echo "$file" | sed 's/_code\.tar\.gz$//')
    echo "   Removing old backup: ${BASENAME}"
    rm -f "${BASENAME}_code.tar.gz"
    rm -f "${BASENAME}_uploads.tar.gz"
    rm -f "${BASENAME}_nginx.tar.gz"
    rm -f "${BASENAME}_ssl.tar.gz"
    rm -f "${BASENAME}_database.db"
    rm -f "${BASENAME}_pm2.js"
    rm -f "${BASENAME}_pm2_dump.pm2"
    rm -f "restore_${BASENAME}.sh"
    rm -f "backup_summary_${BASENAME}.txt"
done

echo ""
echo "=========================================="
echo "BACKUP COMPLETED SUCCESSFULLY!"
echo "=========================================="
echo "Backup Name: ${BACKUP_NAME}"
echo "Location: ${BACKUP_DIR}"
echo ""
echo "Files Created:"
ls -la "${BACKUP_DIR}/${BACKUP_NAME}"*
echo ""
echo "To Restore: bash restore_${BACKUP_NAME}.sh"
echo ""
echo "This backup includes:"
echo "- All application code"
echo "- User data and uploads"
echo "- Configuration files"
echo "- SSL certificates"
echo "- Database"
echo "- Everything needed to fully restore the project"
echo ""
echo "Keep this backup safe!"
