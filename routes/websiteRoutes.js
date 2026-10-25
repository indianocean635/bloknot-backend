const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const { sendWebsiteInvoiceEmail } = require('../services/emailService');

// GET /api/website/config - Получить конфигурацию (CloudPayments Public ID)
router.get('/config', (req, res) => {
  const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
  res.json({
    cloudPaymentsPublicId: publicId || null
  });
});

// Реквизиты ИП Пескова Александра Валерьевича
const COMPANY_DETAILS = {
  name: 'ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ПЕСКОВ АЛЕКСАНДР ВАЛЕРЬЕВИЧ',
  address: '650055, РОССИЯ, КЕМЕРОВСКАЯ ОБЛАСТЬ - КУЗБАСС, Г КЕМЕРОВО, УЛ САРЫГИНА, Д 37, КВ 124',
  inn: '420208173430',
  ogrnip: '326420500029879',
  bankAccount: '40802810400009435884',
  bankName: 'АО «ТБанк»',
  bankInn: '7710140679',
  bankBik: '044525974',
  bankCorrAccount: '30101810145250000974',
  bankAddress: '127287, г. Москва, ул. Хуторская 2-я, д. 38А, стр. 26'
};

// POST /api/website/invoice - Генерация счёта для ИП/ООО
router.post('/invoice', async (req, res) => {
  try {
    const { plan, planName, amount, originalAmount, discount, orgName, orgInn, email } = req.body;

    // Валидация
    if (!plan || !planName || !amount || !orgName || !orgInn || !email) {
      return res.status(400).json({ success: false, error: 'Не все обязательные поля заполнены' });
    }

    if (!/^\d{10,12}$/.test(orgInn)) {
      return res.status(400).json({ success: false, error: 'ИНН должен содержать 10 или 12 цифр' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Некорректный email' });
    }

    // Генерация номера счёта
    const invoiceNumber = 'СЧ-' + Date.now();
    const invoiceDate = new Date().toLocaleDateString('ru-RU');
    const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU'); // Срок оплаты 5 дней

    // Формирование текста счёта
    const invoiceText = `
СЧЁТ НА ОПЛАТУ № ${invoiceNumber}
от ${invoiceDate}

Плательщик:
${orgName}
ИНН: ${orgInn}

Получатель:
${COMPANY_DETAILS.name}
Адрес: ${COMPANY_DETAILS.address}
ИНН: ${COMPANY_DETAILS.inn}
ОГРНИП: ${COMPANY_DETAILS.ogrnip}

Расчётный счёт: ${COMPANY_DETAILS.bankAccount}
Банк: ${COMPANY_DETAILS.bankName}
БИК: ${COMPANY_DETAILS.bankBik}
Корр. счёт: ${COMPANY_DETAILS.bankCorrAccount}

Назначение платежа:
Оплата тарифа "${planName}" за создание сайта
${discount > 0 ? `(Скидка ${discount}%, исходная сумма: ${originalAmount.toLocaleString('ru-RU')} ₽)` : ''}

Сумма к оплате: ${amount.toLocaleString('ru-RU')} ₽
Срок оплаты: ${dueDate}

---
Счёт сформирован автоматически
Сайт: https://bloknotservis.ru/website-pricing.html
Email: ${email}
    `.trim();

    // Генерация QR-кода для СБП
    const sbpPhone = '+79911158391';
    const sbpData = `R0001|ST00012|Name=${COMPANY_DETAILS.name}|PersonalAcc=${COMPANY_DETAILS.bankAccount}|BankName=${COMPANY_DETAILS.bankName}|BIC=${COMPANY_DETAILS.bankBik}|Sum=${amount * 100}|Purpose=Оплата тарифа "${planName}" за создание сайта. Счёт №${invoiceNumber}`;
    const qrCodeBase64 = await QRCode.toDataURL(sbpData, {
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'L'
    });

    // Отправка email со счётом и QR-кодом
    try {
      const emailResult = await sendWebsiteInvoiceEmail(email, {
        invoiceNumber,
        invoiceDate,
        dueDate,
        amount,
        planName,
        orgName,
        orgInn,
        invoiceText,
        qrCode: qrCodeBase64,
        sbpPhone: sbpPhone
      });

      console.log('[WEBSITE INVOICE] Email sent:', emailResult);
    } catch (emailError) {
      console.error('[WEBSITE INVOICE] Failed to send email:', emailError);
    }

    console.log('[WEBSITE INVOICE] Generated invoice:', {
      invoiceNumber,
      orgName,
      orgInn,
      email,
      amount,
      planName
    });

    res.json({
      success: true,
      invoiceNumber,
      invoiceDate,
      dueDate,
      amount,
      invoiceText
    });

  } catch (error) {
    console.error('[WEBSITE INVOICE] Error:', error);
    res.status(500).json({ success: false, error: 'Ошибка при генерации счёта' });
  }
});

module.exports = router;
