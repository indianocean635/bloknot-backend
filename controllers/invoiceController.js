const https = require('https');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

// Ваши реквизиты
const COMPANY_REQUISITES = {
  name: 'ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ ПЕСКОВ АЛЕКСАНДР ВАЛЕРЬЕВИЧ',
  legalAddress: '650055, РОССИЯ, КЕМЕРОВСКАЯ ОБЛАСТЬ - КУЗБАСС, Г КЕМЕРОВО, УЛ САРЫГИНА, Д 37, КВ 124',
  inn: '420208173430',
  ogrn: '326420500029879',
  bankAccount: '40802810400009435884',
  bankName: 'АО «ТБанк»',
  bankInn: '7710140679',
  bankBik: '044525974',
  bankCorrAccount: '30101810145250000974',
  bankAddress: '127287, г. Москва, ул. Хуторская 2-я, д. 38А, стр. 26'
};

// Годовые тарифы
const YEARLY_PLANS = {
  solo: { name: 'Solo', price: 5520, description: '1 специалист' },
  studio: { name: 'Studio', price: 11040, description: '5 специалистов' },
  pro: { name: 'Pro', price: 16560, description: 'Более 5 специалистов' }
};

/**
 * Проверка ИНН через API ФНС
 */
async function checkINN(req, res) {
  try {
    const { inn } = req.body;
    
    if (!inn) {
      return res.status(400).json({ error: 'ИНН обязателен' });
    }

    // Валидация ИНН
    if (!validateINN(inn)) {
      return res.status(400).json({ error: 'Некорректный ИНН' });
    }

    // Запрос к API ФНС
    const companyData = await getCompanyDataFromFNS(inn);
    
    res.json({
      success: true,
      data: companyData
    });
  } catch (error) {
    console.error('[INN CHECK ERROR]', error);
    res.status(500).json({ error: 'Ошибка проверки ИНН' });
  }
}

/**
 * Валидация ИНН
 */
function validateINN(inn) {
  inn = inn.replace(/\D/g, '');
  
  if (inn.length !== 10 && inn.length !== 12) {
    return false;
  }

  if (inn.length === 10) {
    const n9 = parseInt(inn[8]);
    const n10 = parseInt(inn[9]);
    const checksum = ((2 * parseInt(inn[0]) + 4 * parseInt(inn[1]) + 10 * parseInt(inn[2]) +
      3 * parseInt(inn[3]) + 5 * parseInt(inn[4]) + 9 * parseInt(inn[5]) +
      4 * parseInt(inn[6]) + 6 * parseInt(inn[7]) + 8 * n9) % 11) % 10;
    return checksum === n10;
  }

  if (inn.length === 12) {
    const n11 = parseInt(inn[10]);
    const n12 = parseInt(inn[11]);
    const checksum1 = ((7 * parseInt(inn[0]) + 2 * parseInt(inn[1]) + 4 * parseInt(inn[2]) +
      10 * parseInt(inn[3]) + 3 * parseInt(inn[4]) + 5 * parseInt(inn[5]) +
      9 * parseInt(inn[6]) + 4 * parseInt(inn[7]) + 6 * parseInt(inn[8]) +
      8 * parseInt(inn[9])) % 11) % 10;
    const checksum2 = ((3 * parseInt(inn[0]) + 7 * parseInt(inn[1]) + 2 * parseInt(inn[2]) +
      4 * parseInt(inn[3]) + 10 * parseInt(inn[4]) + 3 * parseInt(inn[5]) +
      5 * parseInt(inn[6]) + 9 * parseInt(inn[7]) + 4 * parseInt(inn[8]) +
      6 * parseInt(inn[9]) + 8 * checksum1) % 11) % 10;
    return checksum1 === n11 && checksum2 === n12;
  }

  return false;
}

/**
 * Получение данных компании из ФНС
 */
async function getCompanyDataFromFNS(inn) {
  return new Promise((resolve, reject) => {
    const url = `https://egrul.nalog.ru/?search=${inn}`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result.status === '200' && result.rows && result.rows.length > 0) {
            const company = result.rows[0];
            
            resolve({
              inn: company.i || inn,
              name: company.c || company.n || 'Неизвестная компания',
              ogrn: company.o || '',
              address: company.a || '',
              director: company.g || '',
              kpp: company.p || '',
              status: company.s || 'Действующая'
            });
          } else {
            // Если не найдено в ФНС, возвращаем базовые данные
            resolve({
              inn: inn,
              name: `ИНН ${inn}`,
              ogrn: '',
              address: '',
              director: '',
              kpp: inn.length === 12 ? '' : '0',
              status: 'Требуется проверка'
            });
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Генерация счета в PDF
 */
async function generateInvoice(req, res) {
  try {
    const { plan, clientData } = req.body;
    
    if (!plan || !clientData) {
      return res.status(400).json({ error: 'План и данные клиента обязательны' });
    }

    const planInfo = YEARLY_PLANS[plan];
    if (!planInfo) {
      return res.status(400).json({ error: 'Неверный план подписки' });
    }

    // Создание PDF
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    
    doc.on('data', (chunk) => chunks.push(chunk));
    
    doc.on('end', async () => {
      const pdfBuffer = Buffer.concat(chunks);
      
      // Генерация QR-кода
      const qrData = generateQRData(planInfo, clientData);
      const qrCodeDataURL = await QRCode.toDataURL(qrData);
      
      res.json({
        success: true,
        invoiceBase64: pdfBuffer.toString('base64'),
        qrCode: qrCodeDataURL,
        fileName: `invoice_${Date.now()}.pdf`
      });
    });

    // Заголовок счета
    doc.fontSize(20).text('СЧЕТ НА ОПЛАТУ', { align: 'center' });
    doc.fontSize(12).text(`№ ${Date.now()} от ${new Date().toLocaleDateString('ru-RU')}`, { align: 'center' });
    doc.moveDown();

    // Реквизиты продавца
    doc.fontSize(14).text('Продавец:', { underline: true });
    doc.fontSize(10).text(COMPANY_REQUISITES.name);
    doc.text(`ИНН: ${COMPANY_REQUISITES.inn}`);
    doc.text(`ОГРНИП: ${COMPANY_REQUISITES.ogrn}`);
    doc.text(`Юридический адрес: ${COMPANY_REQUISITES.legalAddress}`);
    doc.moveDown();

    // Банковские реквизиты
    doc.fontSize(12).text('Банковские реквизиты:', { underline: true });
    doc.fontSize(10).text(`Расчетный счет: ${COMPANY_REQUISITES.bankAccount}`);
    doc.text(`Банк: ${COMPANY_REQUISITES.bankName}`);
    doc.text(`БИК: ${COMPANY_REQUISITES.bankBik}`);
    doc.text(`Корр. счет: ${COMPANY_REQUISITES.bankCorrAccount}`);
    doc.moveDown();

    // Реквизиты покупателя
    doc.fontSize(14).text('Покупатель:', { underline: true });
    doc.fontSize(10).text(clientData.name);
    doc.text(`ИНН: ${clientData.inn}`);
    if (clientData.kpp) doc.text(`КПП: ${clientData.kpp}`);
    if (clientData.address) doc.text(`Адрес: ${clientData.address}`);
    doc.moveDown();

    // Таблица с услугой
    doc.fontSize(12).text('Услуги:', { underline: true });
    doc.moveDown();
    
    // Шапка таблицы
    doc.fontSize(10);
    const tableTop = doc.y;
    doc.text('Наименование услуги', 50, tableTop);
    doc.text('Кол-во', 300, tableTop);
    doc.text('Цена', 350, tableTop);
    doc.text('Сумма', 400, tableTop);
    
    // Строка с услугой
    const serviceRow = tableTop + 20;
    doc.text(`Подписка "${planInfo.name}" - годовая (${planInfo.description})`, 50, serviceRow);
    doc.text('1', 300, serviceRow);
    doc.text(`${planInfo.price} ₽`, 350, serviceRow);
    doc.text(`${planInfo.price} ₽`, 400, serviceRow);
    
    // Итого
    doc.moveDown();
    doc.fontSize(12).text(`Итого к оплате: ${planInfo.price} ₽`, { align: 'right' });
    doc.moveDown();

    // Назначение платежа
    doc.fontSize(10).text(`Назначение платежа: Оплата годовой подписки "${planInfo.name}" по Договору-оферте. НДС не облагается.`);
    doc.moveDown();

    // Подпись
    doc.fontSize(10).text('___________________ / Песков А.В. /', { align: 'right' });
    doc.text('(ИП Песков Александр Валерьевич)', { align: 'right' });

    doc.end();
  } catch (error) {
    console.error('[INVOICE GENERATION ERROR]', error);
    res.status(500).json({ error: 'Ошибка генерации счета' });
  }
}

/**
 * Генерация данных для QR-кода
 */
function generateQRData(planInfo, clientData) {
  const paymentData = {
    name: COMPANY_REQUISITES.name,
    inn: COMPANY_REQUISITES.inn,
    account: COMPANY_REQUISITES.bankAccount,
    bankBik: COMPANY_REQUISITES.bankBik,
    corrAccount: COMPANY_REQUISITES.bankCorrAccount,
    amount: planInfo.price,
    description: `Оплата подписки "${planInfo.name}" - годовая`,
    clientInn: clientData.inn
  };

  return `ST00012|Name=${paymentData.name}|PersonalAcc=${paymentData.account}|BankName=${COMPANY_REQUISITES.bankName}|BIC=${paymentData.bankBik}|CorrespAcc=${paymentData.corrAccount}|Sum=${paymentData.amount * 100}|Purpose=${paymentData.description}|PayeeINN=${paymentData.inn}|PayerINN=${paymentData.clientInn}`;
}

/**
 * Получение тарифов
 */
function getPlans(req, res) {
  res.json({
    success: true,
    plans: YEARLY_PLANS
  });
}

module.exports = {
  checkINN,
  generateInvoice,
  getPlans
};
