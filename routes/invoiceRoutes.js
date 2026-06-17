const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { checkINN, generateInvoice, getPlans } = require('../controllers/invoiceController');

const router = express.Router();

// Middleware для аутентификации всех роутов
router.use(requireAuth);

/**
 * Проверка ИНН
 */
router.post('/check-inn', checkINN);

/**
 * Генерация счета
 */
router.post('/generate', generateInvoice);

/**
 * Получение тарифов
 */
router.get('/plans', getPlans);

// Тестовый эндпоинт для проверки PDF
router.post('/test-pdf', async (req, res) => {
  try {
    console.log('[TEST PDF] Starting PDF generation...');
    
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', (chunk) => {
      chunks.push(chunk);
      console.log('[TEST PDF] Chunk received:', chunk.length, 'bytes');
    });
    
    doc.on('end', () => {
      console.log('[TEST PDF] PDF generation completed');
      const pdfBuffer = Buffer.concat(chunks);
      console.log('[TEST PDF] Total size:', pdfBuffer.length, 'bytes');
      
      // Преобразуем в base64
      const pdfBase64 = pdfBuffer.toString('base64');
      console.log('[TEST PDF] Base64 length:', pdfBase64.length);
      
      res.json({
        success: true,
        invoiceBase64: pdfBase64,
        fileName: 'test.pdf'
      });
    });
    
    // Добавляем контент
    doc.fontSize(16).text('Test PDF Document');
    doc.fontSize(12).text('This is a test PDF to verify encoding works correctly.');
    doc.text('Date: ' + new Date().toLocaleDateString('ru-RU'));
    
    doc.end();
    
  } catch (error) {
    console.error('[TEST PDF ERROR]', error);
    res.status(500).json({ error: 'Test PDF generation failed' });
  }
});

module.exports = router;
