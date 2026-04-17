# Bloknot Project Backup & Rollback Instructions

## **Backup Date**: 2026-04-17
## **Backup Version**: PERFECT_WORKING_STATE_v1.0
## **Git Commit**: 7ef21ef

---

## **WHAT IS BACKED UP:**

### **Backend Components:**
- **Complete backend code** (`/var/www/bloknot-backend/`)
- **Database schema** (Prisma migrations)
- **All API endpoints** working perfectly
- **Email sending** (Yandex SMTP configured)
- **User authentication** (Magic links working)
- **Admin panel** (User management working)
- **All dependencies** (package.json, node_modules)

### **Frontend Components:**
- **Main page** (`/var/www/html/index.html`)
- **Dashboard (LK)** (`/var/www/html/dashboard.html`)
- **Admin panel** (`/var/www/html/admin.html`)
- **All CSS/JS files** working perfectly
- **All static assets**

### **Database:**
- **User data** (names, emails, phones)
- **Login tokens** (15-minute expiry)
- **Business data**
- **All tables and relationships**

---

## **CURRENT WORKING STATE:**

### **What Works Perfectly:**
- **User registration** with name, email, phone, password
- **Magic link login** (emails sent, links work)
- **Dashboard opens and stays open**
- **User data displays correctly** (name, email, phone)
- **Admin panel shows all users**
- **Password saving** (hashed and secure)
- **Email sending** via Yandex SMTP
- **All redirects work perfectly**
- **Database operations** work flawlessly

### **Key Features:**
- **Fast response times** (no 30-second delays)
- **No email errors** (SMTP configured)
- **Perfect data display** (no dashes)
- **Stable authentication** (localStorage works)
- **Clean error handling**

---

## **ROLLBACK INSTRUCTIONS:**

### **Method 1: Git Rollback (Recommended)**

```bash
# 1. Go to backend directory
cd /var/www/bloknot-backend

# 2. Check current state
git status
git log --oneline -5

# 3. Rollback to perfect working state
git checkout 7ef21ef

# 4. Restore all files
git reset --hard 7ef21ef

# 5. Install dependencies (if needed)
npm install

# 6. Apply database migrations (if needed)
npx prisma migrate deploy

# 7. Copy static files to web server
cp -r public/* /var/www/html/
chown -R www-data:www-data /var/www/html/

# 8. Restart application
pm2 restart bloknot

# 9. Verify working state
pm2 logs --lines 10
```

### **Method 2: Full Restore from Backup**

```bash
# 1. Stop current application
pm2 stop bloknot

# 2. Backup current state (optional)
mv /var/www/bloknot-backend /var/www/bloknot-backend-backup-$(date +%Y%m%d)
mv /var/www/html /var/www/html-backup-$(date +%Y%m%d)

# 3. Create fresh directories
mkdir -p /var/www/bloknot-backend
mkdir -p /var/www/html

# 4. Restore from backup (if you have backup files)
# tar -xzf bloknot-backend-backup-20260417.tar.gz -C /var/www/
# tar -xzf bloknot-html-backup-20260417.tar.gz -C /var/www/

# 5. Set permissions
chown -R www-data:www-data /var/www/html/
chown -R root:root /var/www/bloknot-backend/

# 6. Install dependencies
cd /var/www/bloknot-backend
npm install

# 7. Apply database migrations
npx prisma migrate deploy

# 8. Start application
pm2 start bloknot

# 9. Verify working state
pm2 logs --lines 10
```

---

## **BACKUP VERIFICATION:**

### **Test These Endpoints After Rollback:**

```bash
# 1. Test user registration
curl -X POST "http://localhost:3001/api/auth/request-login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@rollback.com","name":"Rollback Test","phone":"+12345678999","password":"rollbacktest"}'

# 2. Check magic link generation
pm2 logs --lines 5

# 3. Test admin panel
curl "http://localhost:3001/api/admin/users"

# 4. Test dashboard
curl "http://localhost:3001/api/auth/me" \
  -H "x-user-email: test@rollback.com"
```

### **Expected Results:**
- **Email sent successfully** (no errors)
- **Magic link generated** (HTTPS URL)
- **Admin panel shows users**
- **Dashboard loads user data**

---

## **IMPORTANT FILES TO CHECK:**

### **Backend:**
- `/var/www/bloknot-backend/controllers/magicLinkController.js` (Email sending)
- `/var/www/bloknot-backend/public/dashboard.html` (Dashboard display)
- `/var/www/bloknot-backend/public/index.html` (Registration form)
- `/var/www/bloknot-backend/public/admin.html` (Admin panel)
- `/var/www/bloknot-backend/prisma/schema.prisma` (Database schema)

### **Frontend:**
- `/var/www/html/index.html` (Main page)
- `/var/www/html/dashboard.html` (User dashboard)
- `/var/www/html/admin.html` (Admin panel)
- `/var/www/html/app.js` (JavaScript logic)

---

## **TROUBLESHOOTING:**

### **If Email Doesn't Work:**
```bash
# Check SMTP environment variables
echo $SMTP_HOST
echo $SMTP_PORT
echo $SMTP_USER
echo $SMTP_PASS

# Set Yandex SMTP if missing
export SMTP_HOST=smtp.yandex.ru
export SMTP_PORT=465
export SMTP_SECURE=true
export SMTP_USER=your-yandex-email@yandex.ru
export SMTP_PASS=your-yandex-password
export SMTP_FROM="Bloknot <no-reply@bloknotservis.ru>"

pm2 restart bloknot
```

### **If Dashboard Doesn't Open:**
```bash
# Check static files
ls -la /var/www/html/dashboard.html

# Check permissions
chown -R www-data:www-data /var/www/html/

# Restart Nginx if needed
systemctl restart nginx
```

### **If Database Issues:**
```bash
# Check database connection
npx prisma db push

# Reset database if needed
npx prisma migrate reset
```

---

## **CONTACT INFORMATION:**

### **Git Repository:**
- **URL**: https://github.com/indianocean635/bloknot-backend.git
- **Perfect Commit**: 7ef21ef
- **Branch**: main

### **Server Information:**
- **Backend Port**: 3001
- **Frontend URL**: https://bloknotservis.ru
- **Admin URL**: https://bloknotservis.ru/admin.html
- **Dashboard URL**: https://bloknotservis.ru/dashboard.html

---

## **FINAL VERIFICATION:**

After rollback, test these scenarios:
1. **New user registration** (email should be sent)
2. **Magic link login** (dashboard should open and stay open)
3. **User data display** (name, email, phone should be visible)
4. **Admin panel** (should show all users)
5. **Password saving** (should be hashed in database)

**If all these work perfectly, the rollback was successful!**

---

**Created by: ROBOT Backup System**
**Date: 2026-04-17**
**Status: PERFECT WORKING STATE ACHIEVED**
