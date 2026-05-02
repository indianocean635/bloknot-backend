# S3 (Selectel) Configuration Instructions

## Is S3 Already Configured?

### Check if S3 is configured on your server:

```bash
# SSH to your server
ssh your-server

# Check if S3 variables are set in .env
cd /var/www/bloknot-backend
cat .env | grep S3_
```

**If you see output like this:**
```
S3_REGION=ru-central1
S3_ENDPOINT=https://s3.storage.selcloud.ru
S3_ACCESS_KEY=some-key
S3_SECRET_KEY=some-secret
S3_BUCKET=bloknot-uploads
```
Then S3 is **already configured**.

**If you see no output or empty values**, then S3 is **NOT configured** and you need to set it up.

---

## How to Configure S3 (Selectel)

### Step 1: Create a Selectel Account

1. Go to https://selectel.ru/
2. Register an account
3. Verify your email and phone number
4. Add funds to your account (minimum ~100 RUB for testing)

### Step 2: Create an S3 Bucket

1. Log in to Selectel Control Panel
2. Go to "Object Storage" → "S3 Storage"
3. Click "Create container" (bucket)
4. Enter bucket name: `bloknot-uploads` (or any unique name)
5. Select region: `ru-central1` (Moscow)
6. Access type: **Public** (important for serving images)
7. Click "Create"

### Step 3: Get S3 Access Keys

1. In Selectel Control Panel, go to "Account" → "Users" → "Service Accounts"
2. Click "Create service account"
3. Give it a name (e.g., "bloknot-s3")
4. Select role: "Object Storage Administrator" or "Object Storage User"
5. Create the account
6. **Important:** Copy the **Access Key ID** and **Secret Key** immediately
   - You won't be able to see the Secret Key again after closing the window

### Step 4: Add S3 Configuration to .env on Server

```bash
# SSH to your server
ssh your-server

# Go to project directory
cd /var/www/bloknot-backend

# Edit .env file
nano .env
```

Add these lines at the end of .env:

```env
# S3 (Selectel) for file storage
S3_REGION=ru-central1
S3_ENDPOINT=https://s3.storage.selcloud.ru
S3_ACCESS_KEY=your-access-key-id
S3_SECRET_KEY=your-secret-key
S3_BUCKET=bloknot-uploads
```

Replace:
- `your-access-key-id` with your actual Access Key ID from Selectel
- `your-secret-key` with your actual Secret Key from Selectel
- `bloknot-uploads` with your actual bucket name if different

Save and exit (Ctrl+O, Enter, Ctrl+X for nano)

### Step 5: Restart the Application

```bash
# Restart PM2
pm2 restart bloknot

# Check logs to verify S3 is loaded
pm2 logs bloknot --lines 20
```

You should see something like:
```
S3_BUCKET: bloknot-uploads
```

---

## Verify S3 Configuration

### Test S3 Upload

```bash
# On your server, create a test file
echo "test" > test.txt

# Use AWS CLI to test upload (if installed)
aws s3 cp test.txt s3://bloknot-uploads/test.txt \
  --endpoint-url=https://s3.storage.selcloud.ru \
  --region=ru-central1 \
  --access-key=YOUR_ACCESS_KEY \
  --secret-key=YOUR_SECRET_KEY
```

Or test via the application:
1. Go to your dashboard
2. Try uploading a photo/logo
3. Check if the upload succeeds

### Check if files are uploaded to S3

1. Log in to Selectel Control Panel
2. Go to "Object Storage" → "S3 Storage"
3. Click on your bucket
4. You should see uploaded files there

---

## Troubleshooting

### Error: "Access Denied"

- Check that your S3_ACCESS_KEY and S3_SECRET_KEY are correct
- Make sure the service account has proper permissions
- Verify the bucket name is correct

### Error: "Bucket not found"

- Check that S3_BUCKET name matches your actual bucket name
- Make sure the bucket exists in Selectel
- Verify the region is correct (ru-central1)

### Error: "Endpoint connection failed"

- Check that S3_ENDPOINT is correct: `https://s3.storage.selcloud.ru`
- Verify your server can access the internet
- Check if Selectel is having service issues

### Files not accessible via URL

- Make sure the bucket is set to **Public** access
- Check the URL format: `https://s3.storage.selcloud.ru/bucket-name/file-name`

---

## Current S3 Configuration in Code

The project already has S3 integration:

### File: `lib/s3.js`
- Configured for Selectel S3
- Uses AWS SDK v3
- Endpoint: `https://s3.storage.selcloud.ru`
- Region: `ru-central1`

### File: `controllers/uploadController.js`
- Uses `uploadFile` from `lib/s3.js`
- Uploads avatars for specialists
- Uploads logos and work photos for businesses

### Environment Variables Required:
- `S3_REGION` - Region (default: ru-central1)
- `S3_ENDPOINT` - S3 endpoint (default: https://s3.storage.selcloud.ru)
- `S3_ACCESS_KEY` - Your Selectel access key
- `S3_SECRET_KEY` - Your Selectel secret key
- `S3_BUCKET` - Your bucket name

---

## Cost Estimate (Selectel S3)

- **Storage**: ~0.02 RUB per GB per month
- **Traffic**: First 100GB/month free, then ~0.20 RUB per GB
- **Requests**: First 1000 requests free, then ~0.002 RUB per 1000 requests

For a small business with ~100 photos (1GB total):
- Storage: ~0.02 RUB/month
- Traffic: Free (under 100GB)
- **Total: ~0.02 RUB/month**

---

## Alternative: Local Storage

If you don't want to use S3, the project can also store files locally:

1. Remove S3 variables from .env
2. Files will be stored in `./uploads` directory
3. Update Nginx to serve files from `/var/www/bloknot-backend/uploads`

However, S3 is recommended for:
- Better performance
- Scalability
- CDN capabilities
- Backup and redundancy

---

## Quick Setup Summary

```bash
# 1. Get Selectel S3 credentials (in Selectel Control Panel)
# 2. Add to .env on server:
nano /var/www/bloknot-backend/.env

# Add these lines:
S3_REGION=ru-central1
S3_ENDPOINT=https://s3.storage.selcloud.ru
S3_ACCESS_KEY=your-key
S3_SECRET_KEY=your-secret
S3_BUCKET=bloknot-uploads

# 3. Restart app
pm2 restart bloknot

# 4. Test upload in dashboard
```

---

**Created by: Cascade AI Assistant**
**Date: 2026-05-02**
