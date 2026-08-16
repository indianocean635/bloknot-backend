const express = require('express');
const crypto = require('crypto');
const { prisma } = require('../services/prismaService');

const router = express.Router();

const PLACEHOLDER_OFFER = `[ЗАГЛУШКА] Договор-оферта для исполнителей (партнёров) сервиса Bloknot.

1. Предмет договора
Исполнитель оказывает посреднические услуги по продвижению сервиса онлайн-записи Bloknot путем переписки с потенциальными клиентами.

2. Статус сторон
Стороны являются самостоятельными партнёрами. Ничто в настоящем Договоре не может трактоваться как трудовые отношения.

3. Вознаграждение
Вознаграждение начисляется и выплачивается в порядке, согласованном сторонами отдельно.

4. Персональные данные
Исполнитель даёт согласие на обработку персональных данных в соответствии с Политикой обработки персональных данных.

[ЮРИДИЧЕСКИЙ ТЕКСТ ТРЕБУЕТ ПРОВЕРКИ СПЕЦИАЛИСТОМ]`;

const PLACEHOLDER_PRIVACY = `[ЗАГЛУШКА] Политика обработки персональных данных для партнёров Bloknot.

1. Обработка ПД
Bloknot обрабатывает персональные данные, предоставленные партнёром, исключительно в целях заключения и исполнения договора-оферты.

2. Правовое основание
Обработка основана на согласии партнёра, данном при акцепте оферты.

[ЮРИДИЧЕСКИЙ ТЕКСТ ТРЕБУЕТ ПРОВЕРКИ СПЕЦИАЛИСТОМ]`;

function computeHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket.remoteAddress
    || 'unknown';
}

async function ensureActiveContractVersion() {
  let version = await prisma.contractVersion.findFirst({
    orderBy: { activeFrom: 'desc' }
  });
  if (!version) {
    const versionNumber = '1.0';
    const hash = computeHash(PLACEHOLDER_OFFER + versionNumber);
    version = await prisma.contractVersion.create({
      data: {
        version: versionNumber,
        hash,
        title: 'Договор-оферта с исполнителем v' + versionNumber,
        content: PLACEHOLDER_OFFER,
        activeFrom: new Date()
      }
    });
  }
  return version;
}

async function ensureActivePrivacyVersion() {
  let version = await prisma.policyVersion.findFirst({
    orderBy: { activeFrom: 'desc' }
  });
  if (!version) {
    const versionNumber = '1.0';
    const hash = computeHash(PLACEHOLDER_PRIVACY + versionNumber);
    version = await prisma.policyVersion.create({
      data: {
        version: versionNumber,
        hash,
        title: 'Политика обработки персональных данных партнёров v' + versionNumber,
        content: PLACEHOLDER_PRIVACY,
        activeFrom: new Date()
      }
    });
  }
  return version;
}

function sanitizeInput(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/[<>]/g, '');
}

function validateRequired(value, name) {
  if (!value || !String(value).trim()) return `${name} обязательно`;
  return null;
}

function validatePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10) return 'Номер телефона слишком короткий';
  return null;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Некорректный email';
  return null;
}

function validateInn(inn) {
  const digits = String(inn).replace(/\D/g, '');
  if (digits.length !== 12) return 'ИНН должен содержать 12 цифр';
  return null;
}

function validateBirthDate(date) {
  if (!date) return 'Дата рождения обязательна';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Некорректная дата рождения';
  const now = new Date();
  if (d > now) return 'Дата рождения не может быть в будущем';
  const age = now.getFullYear() - d.getFullYear();
  if (age < 18) return 'Исполнитель должен быть старше 18 лет';
  return null;
}

// Public: get currently active contract and policy for display
router.get('/contract', async (req, res) => {
  try {
    const [contractVersion, privacyVersion] = await Promise.all([
      ensureActiveContractVersion(),
      ensureActivePrivacyVersion()
    ]);

    res.json({
      success: true,
      contract: {
        version: contractVersion.version,
        hash: contractVersion.hash,
        title: contractVersion.title,
        content: contractVersion.content,
        activeFrom: contractVersion.activeFrom
      },
      privacy: {
        version: privacyVersion.version,
        hash: privacyVersion.hash,
        title: privacyVersion.title,
        content: privacyVersion.content,
        activeFrom: privacyVersion.activeFrom
      }
    });
  } catch (error) {
    console.error('[PARTNER CONTRACT GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: get a specific contract version by version number
router.get('/contract/:version', async (req, res) => {
  try {
    const { version } = req.params;
    const contract = await prisma.contractVersion.findUnique({ where: { version } });
    if (!contract) {
      return res.status(404).json({ error: 'Contract version not found' });
    }
    res.json({
      success: true,
      contract: {
        version: contract.version,
        hash: contract.hash,
        title: contract.title,
        content: contract.content,
        activeFrom: contract.activeFrom
      }
    });
  } catch (error) {
    console.error('[PARTNER CONTRACT VERSION GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: get a specific privacy policy version by version number
router.get('/privacy/:version', async (req, res) => {
  try {
    const { version } = req.params;
    const privacy = await prisma.policyVersion.findUnique({ where: { version } });
    if (!privacy) {
      return res.status(404).json({ error: 'Privacy policy version not found' });
    }
    res.json({
      success: true,
      privacy: {
        version: privacy.version,
        hash: privacy.hash,
        title: privacy.title,
        content: privacy.content,
        activeFrom: privacy.activeFrom
      }
    });
  } catch (error) {
    console.error('[PARTNER PRIVACY VERSION GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: submit partner application
router.post('/apply', async (req, res) => {
  try {
    const body = req.body || {};

    const lastName = sanitizeInput(body.lastName);
    const firstName = sanitizeInput(body.firstName);
    const middleName = sanitizeInput(body.middleName);
    const birthDate = body.birthDate;
    const phone = sanitizeInput(body.phone);
    const email = sanitizeInput(body.email).toLowerCase();
    const inn = sanitizeInput(body.inn);
    const isNpdPayer = body.isNpdPayer === true || body.isNpdPayer === 'true';
    const region = sanitizeInput(body.region);
    const telegram = sanitizeInput(body.telegram);
    const bankDetails = sanitizeInput(body.bankDetails);

    const acceptedOffer = body.acceptedOffer === true || body.acceptedOffer === 'true';
    const acceptedNpd = body.acceptedNpd === true || body.acceptedNpd === 'true';
    const acceptedPrivacy = body.acceptedPrivacy === true || body.acceptedPrivacy === 'true';
    const acceptedDataCorrect = body.acceptedDataCorrect === true || body.acceptedDataCorrect === 'true';

    // Server-side validation
    const errors = [];
    const addError = (msg) => msg && errors.push(msg);
    addError(validateRequired(lastName, 'Фамилия'));
    addError(validateRequired(firstName, 'Имя'));
    addError(validateBirthDate(birthDate));
    addError(validatePhone(phone));
    addError(validateEmail(email));
    addError(validateInn(inn));
    addError(validateRequired(region, 'Регион'));
    addError(validateRequired(bankDetails, 'Банковские реквизиты'));

    if (!acceptedOffer) errors.push('Необходимо принять Договор-оферту');
    if (!acceptedNpd) errors.push('Необходимо подтвердить статус плательщика НПД');
    if (!acceptedPrivacy) errors.push('Необходимо дать согласие на обработку ПД');
    if (!acceptedDataCorrect) errors.push('Необходимо подтвердить достоверность данных');

    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const [contractVersion, privacyVersion] = await Promise.all([
      ensureActiveContractVersion(),
      ensureActivePrivacyVersion()
    ]);

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const acceptedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          lastName,
          firstName,
          middleName: middleName || null,
          birthDate: new Date(birthDate),
          phone,
          email,
          inn,
          isNpdPayer,
          region,
          telegram: telegram || null,
          bankDetails,
          acceptedOffer,
          acceptedNpd,
          acceptedPrivacy,
          acceptedDataCorrect,
          contractVersionId: contractVersion.id,
          privacyVersionId: privacyVersion.id,
          ipAddress,
          userAgent,
          status: 'ACCEPTED',
          acceptedAt,
          createdAt: acceptedAt
        }
      });

      await tx.employeeContractAcceptance.create({
        data: {
          employeeId: employee.id,
          contractVersionId: contractVersion.id,
          privacyVersionId: privacyVersion.id,
          ipAddress,
          userAgent,
          acceptedAt
        }
      });

      return employee;
    });

    res.status(201).json({
      success: true,
      id: result.id,
      message: 'Данные успешно отправлены, условия договора приняты.'
    });
  } catch (error) {
    console.error('[PARTNER APPLY]', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Исполнитель с такими данными уже зарегистрирован' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
