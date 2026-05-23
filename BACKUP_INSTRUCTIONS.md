# Bloknot Project Backup & Rollback Instructions

## **Backup Date**: 2026-05-23
## **Backup Version**: TIMEZONE_FIX_v1.0
## **Git Commit**: ecf68b2
## **Git Tag**: backup-2026-05-23-timezone-fix
## **Branch**: main

---

## **WHAT IS BACKED UP:**

### **Backend Components:**
- **Complete backend code** (`/var/www/bloknot-backend/`)
- **Database schema** (Prisma schema with Master, Staff, StaffInvite, Business, User, Subscription, Appointment tables)
- **All API endpoints** working perfectly
- **Email sending** (Yandex SMTP configured for specialist invitations)
- **User authentication** (Email/Password login + JWT cookies)
- **Specialist invitation system** (Email invitations with registration links)
- **Admin panel** (User management working)
- **Subscription system** (Specialist limits based on subscription tier)
- **Settings system** (Business settings, specialists management)
- **Telegram bot integration** (Booking confirmations with inline keyboard buttons)
- **Timezone fix** (Local time display without UTC conversion)
- **All dependencies** (package.json, node_modules)

### **Frontend Components:**
- **Main page** (`public/index.html`) with registration/login modal
- **Dashboard (LK)** (`public/dashboard.html`) with business overview
- **Settings page** (`public/settings.html`) with business and specialist management
- **Specialist schedule settings** (`public/specialist-schedule.html`)
- **Booking link page** (`public/booking-link.html`)
- **Admin panel** (`public/admin.html`) with user management
- **Calendar page** (`public/calendar.html`) with appointment management
- **Booking form** (`public/booking-new.html`) with timezone-aware time selection
- **All CSS/JS files** working perfectly
- **All static assets**

### **Database:**
- **User data** (names, emails, phones, passwords, roles: OWNER, STAFF, SUPER_ADMIN)
- **Business data** (name, slug, settings, subscription)
- **Specialist data** (Master records with names, emails, active status, schedules)
- **Staff data** (Staff records linking users to businesses)
- **Staff invitations** (StaffInvite records with email, businessId, status: pending/accepted)
- **Subscription data** (Subscription records with tiers: FREE, STARTER, PROFESSIONAL, ENTERPRISE)
- **Appointment data** (Booking records with startsAtLocal, endsAtLocal for timezone-aware display)
- **Telegram integration** (Chat IDs, message IDs, booking tokens)
- **Login tokens** (JWT with 30-day expiry)
- **All tables and relationships**

---

## **CURRENT WORKING STATE:**

### **What Works Perfectly:**
- **User registration** with name, email, phone, password (JWT cookies)
- **User login** with email/password (JWT cookies, 30-day expiry)
- **Dashboard opens and stays open** with business data
- **User data displays correctly** (name, email, phone, role)
- **Admin panel shows all users** with business info
- **Specialist invitation system** (Email invitations via Yandex SMTP)
- **Invitation link handling** (Auto-fills email and name in registration)
- **Specialist management** (Create, update, delete specialists)
- **Subscription system** (FREE: 0 specialists, STARTER: 5, PROFESSIONAL: 15, ENTERPRISE: unlimited)
- **Business settings** (Name, address, phone, map location)
- **Specialist schedule settings** (Working hours, break times)
- **Booking link generation** (Personal booking pages)
- **Email sending** via Yandex SMTP
- **Telegram bot integration** (Booking confirmations with inline keyboard buttons)
- **Timezone fix** (Local time display without UTC conversion - shows client's selected time exactly)
- **All redirects work perfectly**
- **Database operations** work flawlessly

### **Key Features:**
- **Fast response times** (no delays)
- **No email errors** (SMTP configured)
- **Perfect data display** (correct specialist limits, subscription persistence)
- **Stable authentication** (JWT cookies, no localStorage)
- **Clean error handling**
- **Race condition fixes** (Registration redirect with localStorage token)
- **Duplicate invitation prevention** (StaffInvite table checks)
- **Staff role assignment** (Invited users become STAFF in business)
- **Timezone-aware booking** (startsAtLocal and endsAtLocal fields store original client time)
- **Telegram bot stability** (isRunning check before bot.stop, full error logging)
- **Inline keyboard buttons** (Cancel and Reschedule buttons in Telegram messages)

---

## **ROLLBACK INSTRUCTIONS:**

### **Method 1: Git Rollback (Recommended)**

```bash
# 1. Go to backend directory
cd /var/www/bloknot-backend

# 2. Check current state
git status
git log --oneline -5

# 3. Rollback to backup state (May 23, 2026)
git checkout backup-2026-05-23-timezone-fix

# 4. Restore all files
git reset --hard backup-2026-05-23-timezone-fix

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
curl -X POST "http://localhost:3001/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@rollback.com","name":"Rollback Test","phone":"+71234567899","password":"rollbacktest"}'

# 2. Test user login
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@rollback.com","password":"rollbacktest"}'

# 3. Test admin panel (requires admin auth)
curl "http://localhost:3001/api/admin/users"

# 4. Test specialist invitation (requires auth)
curl -X POST "http://localhost:3001/api/settings/invite-specialist" \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_JWT_TOKEN" \
  -d '{"email":"specialist@test.com","name":"Test Specialist"}'
```

### **Expected Results:**
- **User registered successfully** (JWT token returned)
- **User logged in successfully** (JWT token returned)
- **Admin panel shows users**
- **Specialist invitation sent** (email via SMTP)

---

## **IMPORTANT FILES TO CHECK:**

### **Backend:**
- `/var/www/bloknot-backend/routes/authRoutes.js` (Registration/Login with JWT)
- `/var/www/bloknot-backend/routes/settingsRoutes.js` (Settings & Specialist invitations)
- `/var/www/bloknot-backend/routes/specialistsRoutes.js` (Specialist CRUD)
- `/var/www/bloknot-backend/routes/subscriptionRoutes.js` (Subscription management)
- `/var/www/bloknot-backend/public/dashboard.html` (Dashboard display)
- `/var/www/bloknot-backend/public/index.html` (Main page with auth modal)
- `/var/www/bloknot-backend/public/settings.html` (Business & specialist settings)
- `/var/www/bloknot-backend/public/admin.html` (Admin panel)
- `/var/www/bloknot-backend/prisma/schema.prisma` (Database schema)

### **Frontend:**
- `/var/www/html/index.html` (Main page with auth modal)
- `/var/www/html/dashboard.html` (User dashboard)
- `/var/www/html/settings.html` (Business settings)
- `/var/www/html/admin.html` (Admin panel)

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

### **If Authentication Issues:**
```bash
# Check JWT secret
echo $JWT_SECRET

# Check cookie settings
pm2 logs | grep -i cookie

# Clear cookies in browser and try again
```

### **If Database Issues:**
```bash
# Check database connection
npx prisma db push

# Check database schema
npx prisma studio

# Reset database if needed (WARNING: deletes all data)
npx prisma migrate reset
```

---

## **CONTACT INFORMATION:**

### **Git Repository:**
- **URL**: https://github.com/indianocean635/bloknot-backend.git
- **Backup Commit**: ecf68b2
- **Branch**: main
- **Backup Tag**: backup-2026-05-23-timezone-fix

### **Server Information:**
- **Backend Port**: 3001
- **Frontend URL**: https://bloknotservis.ru
- **Admin URL**: https://bloknotservis.ru/admin.html
- **Dashboard URL**: https://bloknotservis.ru/dashboard.html
- **Settings URL**: https://bloknotservis.ru/settings.html

---

## **FINAL VERIFICATION:**

After rollback, test these scenarios:
1. **New user registration** (JWT token should be returned, user created with business)
2. **User login** (JWT token should be returned, 30-day expiry)
3. **Dashboard opens** (business data should load correctly)
4. **User data display** (name, email, phone, role should be visible)
5. **Admin panel** (should show all users with business info)
6. **Specialist invitation** (email should be sent via Yandex SMTP)
7. **Invitation link** (should auto-fill email and name in registration)
8. **Invited user registration** (should become STAFF in business)
9. **Subscription system** (specialist limits should work correctly)
10. **Settings save** (business settings and specialists should persist)
11. **Booking creation** (time should be saved without timezone conversion)
12. **Telegram bot** (inline keyboard buttons should appear when API is accessible)

**If all these work perfectly, the rollback was successful!**

---

## **DATABASE BACKUP INSTRUCTIONS:**

### **Create Database Backup:**

```bash
# 1. Go to backend directory
cd /var/www/bloknot-backend

# 2. Export database to SQL file
pg_dump $DATABASE_URL > backup-database-$(date +%Y%m%d).sql

# 3. Compress the backup
gzip backup-database-$(date +%Y%m%d).sql

# 4. Move to safe location
mv backup-database-$(date +%Y%m%d).sql.gz /root/backups/
```

### **Restore Database from Backup:**

```bash
# 1. Go to backend directory
cd /var/www/bloknot-backend

# 2. Decompress backup
gunzip /root/backups/backup-database-20260523.sql.gz

# 3. Restore database
psql $DATABASE_URL < /root/backups/backup-database-20260523.sql

# 4. Verify data
npx prisma studio
```

### **Automated Daily Backup (Optional):**

```bash
# Add to crontab: crontab -e
# Run daily at 3 AM
0 3 * * * cd /var/www/bloknot-backend && pg_dump $DATABASE_URL | gzip > /root/backups/backup-database-$(date +\%Y\%m\%d).sql.gz
```

---

**Created by: Cascade AI Assistant**
**Date: 2026-05-23**
**Status: TIMEZONE_FIX_WORKING_STATE_ACHIEVED**
