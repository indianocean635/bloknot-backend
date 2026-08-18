const express = require('express');
const crypto = require('crypto');
const { prisma } = require('../services/prismaService');
const { sendGuardianConsentLinkEmail, sendGuardianOtpEmail } = require('../services/emailService');
const { uploadPrivateFile } = require('../lib/s3');
const {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  canSendOtp,
  recordOtpSent,
  canVerifyOtp,
  recordFailedAttempt
} = require('../services/otpService');

const router = express.Router();

const PARTNER_BASE_URL = process.env.PARTNER_BASE_URL || 'https://bloknotservis.ru';

const PLACEHOLDER_GUARDIAN_CONSENT = `СОГЛАСИЕ ЗАКОННОГО ПРЕДСТАВИТЕЛЯ

[Юридический текст по запросу. Замените на финальную редакцию.]\n\nВерсия 1.0`;

const PLACEHOLDER_MINOR_PRIVACY = `СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ НЕСОВЕРШЕННОЛЕТНЕГО

[Юридический текст по запросу. Замените на финальную редакцию.]\n\nВерсия 1.0`;

const PLACEHOLDER_OFFER = `ДОГОВОР-ОФЕРТА

[Базовый плейсхолдер для первичного создания версии при отсутствии активной оферты.]\n\nРедакция от: 18.08.2026`;

const RELATIONSHIPS = ['MOTHER', 'FATHER', 'ADOPTIVE_PARENT', 'CURATOR', 'GUARDIAN'];

function sanitizeInput(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[<>]/g, '').trim();
}

function getClientInfo(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || req.socket?.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  return { ipAddress: String(ipAddress).split(',')[0].trim(), userAgent };
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function calculateAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function isValidMinorAge(birthDate) {
  const age = calculateAge(birthDate);
  return age >= 14 && age <= 17;
}

function safeFileName(originalName) {
  const ext = String(originalName || '.pdf').toLowerCase();
  const base = ext.includes('.pdf') ? '.pdf' : '.jpg';
  const now = Date.now();
  const rand = crypto.randomBytes(8).toString('hex');
  return `minor-docs/${rand}-${now}${base}`;
}

async function ensureContractVersion() {
  let version = await prisma.contractVersion.findFirst({
    orderBy: { activeFrom: 'desc' }
  });
  if (version) return version;
  const content = PLACEHOLDER_OFFER;
  const hash = hashText(content);
  version = await prisma.contractVersion.create({
    data: { version: '1.0', hash, title: 'Договор-оферта', content, activeFrom: new Date() }
  });
  return version;
}

async function ensureGuardianConsentVersion() {
  let version = await prisma.guardianConsentVersion.findFirst({
    orderBy: { activeFrom: 'desc' }
  });
  if (version) return version;
  const content = PLACEHOLDER_GUARDIAN_CONSENT;
  const hash = hashText(content);
  version = await prisma.guardianConsentVersion.create({
    data: { version: '1.0', hash, title: 'Согласие законного представителя', content, activeFrom: new Date() }
  });
  return version;
}

async function ensureMinorPrivacyConsentVersion() {
  let version = await prisma.minorPrivacyConsentVersion.findFirst({
    orderBy: { activeFrom: 'desc' }
  });
  if (version) return version;
  const content = PLACEHOLDER_MINOR_PRIVACY;
  const hash = hashText(content);
  version = await prisma.minorPrivacyConsentVersion.create({
    data: { version: '1.0', hash, title: 'Согласие на обработку персональных данных несовершеннолетнего', content, activeFrom: new Date() }
  });
  return version;
}

async function createConsentEvent({ legalRepresentativeConsentId, employeeId, event, metadata, ipAddress, userAgent }) {
  try {
    await prisma.consentEvent.create({
      data: {
        legalRepresentativeConsentId: legalRepresentativeConsentId || null,
        employeeId: employeeId || null,
        event,
        metadata: metadata || {},
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      }
    });
  } catch (e) {
    console.error('[CONSENT EVENT] Failed to log event:', e);
  }
}

async function uploadBase64Document(employeeId, doc, { ipAddress, userAgent }) {
  const base64 = doc.base64 || doc;
  let data = base64;
  let contentType = 'application/pdf';

  if (base64.includes(',')) {
    const parts = base64.split(',');
    const header = parts[0];
    data = parts[1];
    const mimeMatch = header.match(/data:([^;]+);/);
    if (mimeMatch) contentType = mimeMatch[1];
  }

  const buffer = Buffer.from(data, 'base64');
  if (!buffer || buffer.length === 0) throw new Error('Invalid document data');

  const fileName = `minor-docs/${employeeId}/${doc.type}-${crypto.randomUUID()}${contentType.includes('pdf') ? '.pdf' : '.jpg'}`;
  const fileUrl = await uploadPrivateFile(buffer, fileName, contentType);

  return { type: doc.type, fileUrl, originalName: doc.fileName || fileName, fileSize: buffer.length };
}

// POST /api/partners/minor/initiate
router.post('/initiate', async (req, res) => {
  try {
    const body = req.body || {};
    const { ipAddress, userAgent } = getClientInfo(req);

    const lastName = sanitizeInput(body.lastName);
    const firstName = sanitizeInput(body.firstName);
    const middleName = sanitizeInput(body.middleName) || null;
    const birthDate = parseDate(body.birthDate);
    const phone = sanitizeInput(body.phone);
    const email = sanitizeInput(body.email).toLowerCase();
    const inn = sanitizeInput(body.inn);
    const isNpdPayer = body.isNpdPayer === true || body.isNpdPayer === 'true';
    const region = sanitizeInput(body.region);
    const telegram = sanitizeInput(body.telegram) || null;
    const bankDetails = sanitizeInput(body.bankDetails);
    const idempotencyKey = sanitizeInput(body.idempotencyKey) || null;

    const rep = body.representative || {};
    const representativeLastName = sanitizeInput(rep.lastName);
    const representativeFirstName = sanitizeInput(rep.firstName);
    const representativeMiddleName = sanitizeInput(rep.middleName) || null;
    const representativeBirthDate = parseDate(rep.birthDate);
    const representativeStatus = sanitizeInput(rep.status).toUpperCase();
    const representativeEmail = sanitizeInput(rep.email).toLowerCase();
    const representativePhone = sanitizeInput(rep.phone);
    const representativeAddress = sanitizeInput(rep.address) || null;

    if (!lastName || !firstName || !birthDate || !phone || !email || !inn || !region || !bankDetails || !telegram) {
      return res.status(400).json({ error: 'Все поля несовершеннолетнего обязательны' });
    }
    if (!isValidMinorAge(birthDate)) {
      return res.status(400).json({ error: 'Возраст должен быть от 14 до 17 лет' });
    }
    if (!representativeLastName || !representativeFirstName || !representativeStatus || !representativeEmail || !representativePhone) {
      return res.status(400).json({ error: 'Все поля законного представителя обязательны' });
    }
    if (!RELATIONSHIPS.includes(representativeStatus)) {
      return res.status(400).json({ error: 'Недопустимый статус представителя' });
    }
    if (email === representativeEmail) {
      return res.status(400).json({ error: 'Email законного представителя должен отличаться от email несовершеннолетнего' });
    }

    const documents = Array.isArray(body.documents) ? body.documents : [];
    const needsAuthorityDoc = ['ADOPTIVE_PARENT', 'CURATOR'].includes(representativeStatus);
    const hasAuthorityDoc = documents.some(d => d.type === 'AUTHORITY');
    if (needsAuthorityDoc && !hasAuthorityDoc) {
      return res.status(400).json({ error: 'Требуется документ, подтверждающий полномочия представителя' });
    }

    if (idempotencyKey) {
      const existing = await prisma.employee.findUnique({
        where: { idempotencyKey },
        include: { guardianConsent: true }
      });
      if (existing) {
        return res.status(200).json({
          id: existing.id,
          token: existing.guardianConsent?.token,
          nextStep: 'guardian_consent_pending',
          representativeEmail: existing.representativeEmail,
          alreadyExists: true
        });
      }
    }

    const [guardianVersion, contractVersion] = await Promise.all([
      ensureGuardianConsentVersion(),
      ensureContractVersion()
    ]);

    const token = crypto.randomUUID();
    const employeeId = crypto.randomUUID();

    // Pre-upload documents before transaction
    const uploadedDocs = [];
    for (const doc of documents) {
      if (!doc || !doc.type || !doc.base64) continue;
      const up = await uploadBase64Document(employeeId, doc, { ipAddress, userAgent });
      uploadedDocs.push(up);
    }

    const result = await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          id: employeeId,
          lastName,
          firstName,
          middleName,
          birthDate,
          phone,
          email,
          inn,
          isNpdPayer,
          region,
          telegram,
          bankDetails,
          ageCategory: 'MINOR',
          representativeLastName,
          representativeFirstName,
          representativeMiddleName,
          representativeBirthDate,
          representativeStatus,
          representativeEmail,
          representativePhone,
          representativeAddress,
          representativeRelationship: representativeStatus,
          isFullLegalCapacity: false,
          idempotencyKey,
          ipAddress,
          userAgent,
          status: 'PENDING',
          acceptedAt: null
        }
      });

      await tx.legalRepresentativeConsent.create({
        data: {
          employeeId: employee.id,
          token,
          status: 'PENDING',
          minorLastName: lastName,
          minorFirstName: firstName,
          minorMiddleName: middleName,
          minorBirthDate: birthDate,
          minorInn: inn,
          representativeLastName,
          representativeFirstName,
          representativeMiddleName,
          representativeBirthDate,
          representativeStatus,
          representativeEmail,
          representativePhone,
          guardianConsentVersionId: guardianVersion.id,
          contractVersionId: contractVersion.id,
          guardianConsentHash: guardianVersion.hash,
          contractHash: contractVersion.hash,
          ipAddress,
          userAgent
        }
      });

      if (uploadedDocs.length > 0) {
        await tx.employeeDocument.createMany({
          data: uploadedDocs.map(d => ({
            employeeId: employee.id,
            type: d.type,
            fileUrl: d.fileUrl,
            originalName: d.originalName,
            fileSize: d.fileSize
          }))
        });
      }

      return employee;
    });

    await createConsentEvent({
      employeeId: result.id,
      event: 'CONSENT_CREATED',
      metadata: { token },
      ipAddress,
      userAgent
    });

    res.status(201).json({
      id: result.id,
      token,
      nextStep: 'enter_otp',
      representativeEmail
    });
  } catch (error) {
    console.error('[MINOR INITIATE] Error:', error);
    res.status(500).json({ error: 'Ошибка при сохранении заявки несовершеннолетнего' });
  }
});

// GET /api/partners/minor/guardian-consent?token=...
router.get('/guardian-consent', async (req, res) => {
  try {
    const token = sanitizeInput(req.query.token);
    if (!token) return res.status(400).json({ error: 'Токен обязателен' });

    const consent = await prisma.legalRepresentativeConsent.findUnique({
      where: { token },
      include: { guardianConsentVersion: true, contractVersion: true, employee: true }
    });

    if (!consent) return res.status(404).json({ error: 'Ссылка устарела или недействительна' });

    res.json({
      status: consent.status,
      minor: {
        lastName: consent.minorLastName,
        firstName: consent.minorFirstName,
        middleName: consent.minorMiddleName,
        birthDate: consent.minorBirthDate,
        inn: consent.minorInn
      },
      representative: {
        lastName: consent.representativeLastName,
        firstName: consent.representativeFirstName,
        middleName: consent.representativeMiddleName,
        birthDate: consent.representativeBirthDate,
        status: consent.representativeStatus,
        email: consent.representativeEmail,
        phone: consent.representativePhone
      },
      guardianConsent: {
        version: consent.guardianConsentVersion.version,
        title: consent.guardianConsentVersion.title,
        hash: consent.guardianConsentVersion.hash,
        activeFrom: consent.guardianConsentVersion.activeFrom,
        content: consent.guardianConsentVersion.content
      },
      contractVersion: {
        version: consent.contractVersion.version,
        title: consent.contractVersion.title,
        hash: consent.contractVersion.hash
      },
      checkboxes: {
        confirmedRepresentative: consent.confirmedRepresentative,
        confirmedConsent: consent.confirmedConsent,
        confirmedRead: consent.confirmedRead
      }
    });
  } catch (error) {
    console.error('[GUARDIAN CONSENT GET] Error:', error);
    res.status(500).json({ error: 'Ошибка при получении согласия' });
  }
});

// POST /api/partners/minor/guardian-consent/request-otp
router.post('/guardian-consent/request-otp', async (req, res) => {
  try {
    const { ipAddress, userAgent } = getClientInfo(req);
    const token = sanitizeInput(req.body.token);
    const confirmedRepresentative = req.body.confirmedRepresentative === true || req.body.confirmedRepresentative === 'true';
    const confirmedConsent = req.body.confirmedConsent === true || req.body.confirmedConsent === 'true';
    const confirmedRead = req.body.confirmedRead === true || req.body.confirmedRead === 'true';

    if (!token) return res.status(400).json({ error: 'Токен обязателен' });
    if (!confirmedRepresentative || !confirmedConsent || !confirmedRead) {
      return res.status(400).json({ error: 'Необходимо установить все три отметки' });
    }

    const consent = await prisma.legalRepresentativeConsent.findUnique({
      where: { token },
      include: { employee: true }
    });
    if (!consent) return res.status(404).json({ error: 'Ссылка устарела или недействительна' });

    const sendCheck = canSendOtp(consent);
    if (!sendCheck.allowed) {
      await createConsentEvent({
        legalRepresentativeConsentId: consent.id,
        employeeId: consent.employeeId,
        event: 'OTP_REQUEST_DENIED',
        metadata: { reason: sendCheck.reason },
        ipAddress,
        userAgent
      });
      return res.status(429).json({ error: sendCheck.reason });
    }

    const now = new Date();

    // Update checkbox confirmations before sending OTP
    await prisma.legalRepresentativeConsent.update({
      where: { id: consent.id },
      data: {
        confirmedRepresentative: true,
        representativeConsentAt: now,
        confirmedConsent: true,
        consentGivenAt: now,
        confirmedRead: true,
        documentReadAt: now
      }
    });

    const code = generateOtp();
    const otpHash = await hashOtp(code);
    const updated = await recordOtpSent(consent.id, otpHash);

    const emailResult = await sendGuardianOtpEmail(consent.representativeEmail, {
      code,
      minorName: `${consent.minorLastName} ${consent.minorFirstName}`,
      minorBirthDate: consent.minorBirthDate
    });

    await createConsentEvent({
      legalRepresentativeConsentId: consent.id,
      employeeId: consent.employeeId,
      event: 'OTP_SENT',
      metadata: { sent: emailResult.sent, reason: emailResult.reason },
      ipAddress,
      userAgent
    });

    if (!emailResult.sent) {
      return res.status(500).json({ error: 'Не удалось отправить код. Проверьте настройки почты.' });
    }

    res.json({
      sent: true,
      email: consent.representativeEmail,
      status: updated.status,
      nextStep: 'enter_otp'
    });
  } catch (error) {
    console.error('[REQUEST OTP] Error:', error);
    res.status(500).json({ error: 'Ошибка при отправке кода' });
  }
});

// POST /api/partners/minor/guardian-consent/verify-otp
router.post('/guardian-consent/verify-otp', async (req, res) => {
  try {
    const { ipAddress, userAgent } = getClientInfo(req);
    const token = sanitizeInput(req.body.token);
    const code = sanitizeInput(req.body.code);

    if (!token || !code) {
      return res.status(400).json({ error: 'Токен и код обязательны' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Код должен состоять из 6 цифр' });
    }

    const consent = await prisma.legalRepresentativeConsent.findUnique({
      where: { token },
      include: { employee: true, guardianConsentVersion: true, contractVersion: true }
    });
    if (!consent) return res.status(404).json({ error: 'Ссылка устарела или недействительна' });

    const verifyCheck = canVerifyOtp(consent);
    if (!verifyCheck.allowed) {
      await createConsentEvent({
        legalRepresentativeConsentId: consent.id,
        employeeId: consent.employeeId,
        event: 'OTP_VERIFY_DENIED',
        metadata: { reason: verifyCheck.reason },
        ipAddress,
        userAgent
      });
      return res.status(400).json({ error: verifyCheck.reason });
    }

    const isValid = await verifyOtpHash(code, consent.otpHash);
    if (!isValid) {
      await recordFailedAttempt(consent.id);
      await createConsentEvent({
        legalRepresentativeConsentId: consent.id,
        employeeId: consent.employeeId,
        event: 'OTP_FAILED',
        metadata: { codeEntered: true },
        ipAddress,
        userAgent
      });
      const remaining = Math.max(0, 5 - (consent.attemptCount + 1));
      return res.status(400).json({
        error: 'Неверный код.',
        remainingAttempts: remaining
      });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.legalRepresentativeConsent.update({
        where: { id: consent.id },
        data: {
          status: 'CONFIRMED',
          otpVerifiedAt: now,
          verifiedAt: now,
          updatedAt: now
        }
      }),
      prisma.employee.update({
        where: { id: consent.employeeId },
        data: { status: 'GUARDIAN_CONSENT_CONFIRMED' }
      })
    ]);

    await createConsentEvent({
      legalRepresentativeConsentId: consent.id,
      employeeId: consent.employeeId,
      event: 'OTP_VERIFIED',
      metadata: {},
      ipAddress,
      userAgent
    });
    await createConsentEvent({
      legalRepresentativeConsentId: consent.id,
      employeeId: consent.employeeId,
      event: 'CONSENT_CONFIRMED',
      metadata: {
        guardianConsentVersion: consent.guardianConsentVersion.version,
        contractVersion: consent.contractVersion.version
      },
      ipAddress,
      userAgent
    });

    res.json({
      success: true,
      message: 'Согласие законного представителя подтверждено',
      confirmedAt: now,
      nextStep: 'privacy_consent'
    });
  } catch (error) {
    console.error('[VERIFY OTP] Error:', error);
    res.status(500).json({ error: 'Ошибка при проверке кода' });
  }
});

// POST /api/partners/minor/privacy-consent
router.post('/privacy-consent', async (req, res) => {
  try {
    const { ipAddress, userAgent } = getClientInfo(req);
    const token = sanitizeInput(req.body.token);
    const accepted = req.body.accepted === true || req.body.accepted === 'true';

    if (!token) return res.status(400).json({ error: 'Токен обязателен' });
    if (!accepted) return res.status(400).json({ error: 'Необходимо дать согласие на обработку персональных данных' });

    const consent = await prisma.legalRepresentativeConsent.findUnique({
      where: { token },
      include: { employee: true }
    });
    if (!consent) return res.status(404).json({ error: 'Ссылка устарела или недействительна' });
    if (consent.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Сначала требуется подтверждение законного представителя' });
    }

    const privacyVersion = await ensureMinorPrivacyConsentVersion();
    const now = new Date();

    await prisma.$transaction([
      prisma.minorPersonalDataConsent.upsert({
        where: { employeeId: consent.employeeId },
        update: {
          privacyVersionId: privacyVersion.id,
          privacyHash: privacyVersion.hash,
          acceptedAt: now,
          ipAddress,
          userAgent,
          confirmedBy: 'MINOR'
        },
        create: {
          employeeId: consent.employeeId,
          privacyVersionId: privacyVersion.id,
          privacyHash: privacyVersion.hash,
          acceptedAt: now,
          ipAddress,
          userAgent,
          confirmedBy: 'MINOR'
        }
      }),
      prisma.employee.update({
        where: { id: consent.employeeId },
        data: { status: 'PRIVACY_CONSENT_CONFIRMED' }
      })
    ]);

    await createConsentEvent({
      legalRepresentativeConsentId: consent.id,
      employeeId: consent.employeeId,
      event: 'PRIVACY_CONSENT',
      metadata: { privacyVersion: privacyVersion.version },
      ipAddress,
      userAgent
    });

    res.json({
      success: true,
      nextStep: 'accept_offer'
    });
  } catch (error) {
    console.error('[PRIVACY CONSENT] Error:', error);
    res.status(500).json({ error: 'Ошибка при сохранении согласия на ПД' });
  }
});

// POST /api/partners/minor/accept-offer
router.post('/accept-offer', async (req, res) => {
  try {
    const { ipAddress, userAgent } = getClientInfo(req);
    const token = sanitizeInput(req.body.token);
    const accepted = req.body.accepted === true || req.body.accepted === 'true';

    if (!token) return res.status(400).json({ error: 'Токен обязателен' });
    if (!accepted) return res.status(400).json({ error: 'Необходимо принять Договор-оферту' });

    const consent = await prisma.legalRepresentativeConsent.findUnique({
      where: { token },
      include: { employee: { include: { minorPrivacyConsent: true } } }
    });
    if (!consent) return res.status(404).json({ error: 'Ссылка устарела или недействительна' });
    if (consent.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Сначала требуется подтверждение законного представителя' });
    }
    if (!consent.employee.minorPrivacyConsent) {
      return res.status(400).json({ error: 'Сначала требуется согласие на обработку персональных данных' });
    }

    const contractVersion = await ensureContractVersion();
    const now = new Date();

    await prisma.$transaction([
      prisma.minorContractAcceptance.upsert({
        where: { employeeId: consent.employeeId },
        update: {
          contractVersionId: contractVersion.id,
          contractHash: contractVersion.hash,
          acceptedAt: now,
          ipAddress,
          userAgent
        },
        create: {
          employeeId: consent.employeeId,
          contractVersionId: contractVersion.id,
          contractHash: contractVersion.hash,
          acceptedAt: now,
          ipAddress,
          userAgent
        }
      }),
      prisma.employee.update({
        where: { id: consent.employeeId },
        data: {
          acceptedOffer: true,
          offerAcceptedAt: now,
          contractVersionId: contractVersion.id,
          status: 'CONFIRMED'
        }
      })
    ]);

    await createConsentEvent({
      legalRepresentativeConsentId: consent.id,
      employeeId: consent.employeeId,
      event: 'OFFER_ACCEPTED',
      metadata: { contractVersion: contractVersion.version },
      ipAddress,
      userAgent
    });

    res.json({
      success: true,
      registrationId: consent.employeeId,
      contractVersion: contractVersion.version,
      acceptedAt: now,
      nextStep: 'completed'
    });
  } catch (error) {
    console.error('[ACCEPT OFFER] Error:', error);
    res.status(500).json({ error: 'Ошибка при акцепте оферты' });
  }
});

// GET /api/partners/minor/guardian-consent-version
router.get('/guardian-consent-version', async (req, res) => {
  try {
    const version = req.query.version ? sanitizeInput(req.query.version) : null;
    const where = version ? { version } : undefined;
    const v = version
      ? await prisma.guardianConsentVersion.findUnique({ where })
      : await prisma.guardianConsentVersion.findFirst({ orderBy: { activeFrom: 'desc' } });
    if (!v) return res.status(404).json({ error: 'Версия не найдена' });
    res.json({ version: v.version, title: v.title, hash: v.hash, activeFrom: v.activeFrom, content: v.content });
  } catch (error) {
    console.error('[GUARDIAN CONSENT VERSION] Error:', error);
    res.status(500).json({ error: 'Ошибка при получении версии согласия' });
  }
});

// GET /api/partners/minor/minor-privacy-version
router.get('/minor-privacy-version', async (req, res) => {
  try {
    const version = req.query.version ? sanitizeInput(req.query.version) : null;
    const v = version
      ? await prisma.minorPrivacyConsentVersion.findUnique({ where: { version } })
      : await prisma.minorPrivacyConsentVersion.findFirst({ orderBy: { activeFrom: 'desc' } });
    if (!v) return res.status(404).json({ error: 'Версия не найдена' });
    res.json({ version: v.version, title: v.title, hash: v.hash, activeFrom: v.activeFrom, content: v.content });
  } catch (error) {
    console.error('[MINOR PRIVACY VERSION] Error:', error);
    res.status(500).json({ error: 'Ошибка при получении версии согласия на ПД' });
  }
});

module.exports = router;
