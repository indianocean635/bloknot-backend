const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
require('dotenv').config();

// S3 Client configuration for Selectel
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'ru-central1',
  endpoint: process.env.S3_ENDPOINT || 'https://s3.storage.selcloud.ru',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
  // Follow redirects for Selectel S3 compatibility
  requestHandler: new NodeHttpHandler({
    httpsAgent: require('https').Agent({
      keepAlive: true,
      maxSockets: 50,
    }),
  }),
});

/**
 * Upload file to Selectel S3
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - File name
 * @param {string} contentType - Content type
 * @returns {Promise<string>} - File URL
 */
async function uploadFile(buffer, fileName, contentType = 'image/jpeg') {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    });

    await s3Client.send(command);

    // Return public URL
    const fileUrl = `https://s3.storage.selcloud.ru/${process.env.S3_BUCKET}/${fileName}`;
    console.log('File uploaded to S3:', fileUrl);
    
    return fileUrl;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3');
  }
}

module.exports = {
  uploadFile,
};
