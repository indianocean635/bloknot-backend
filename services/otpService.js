const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { prisma } = require('./prismaService');

const OTP_LENGTH = 6;
const OTP_EXPIRES_MS = 10 * 60 * 1000; // 10 minutes
const MIN_RESEND_INTERVAL_MS = 60 * 1000; // 60 seconds
const MAX_RESEND_PER_HOUR = 3;
const MAX_ATTEMPTS = 5;

function generateOtp() {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(OTP_LENGTH, '0');
  return code;
}

async function hashOtp(code) {
  return bcrypt.hash(code, 10);
}

async function verifyOtpHash(code, hash) {
  if (!code || !hash) return false;
  return bcrypt.compare(code, hash);
}

function isOtpExpired(consent) {
  if (!consent.otpExpiresAt) return true;
  return new Date() > new Date(consent.otpExpiresAt);
}

function canSendOtp(consent) {
  const now = new Date();
  const lastResend = consent.lastResentAt ? new Date(consent.lastResentAt) : null;
  const lastHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  if (consent.status === 'LOCKED' || consent.status === 'CONFIRMED' || consent.status === 'REJECTED') {
    return { allowed: false, reason: 'Consent is not in a state to receive OTP' };
  }

  const currentResendCount = (lastResend && lastResend > lastHourAgo) ? consent.resendCount : 0;

  if (lastResend && (now - lastResend) < MIN_RESEND_INTERVAL_MS) {
    const waitSeconds = Math.ceil((MIN_RESEND_INTERVAL_MS - (now - lastResend)) / 1000);
    return { allowed: false, reason: `Подождите ${waitSeconds} секунд перед повторной отправкой.` };
  }

  if (currentResendCount >= MAX_RESEND_PER_HOUR) {
    return { allowed: false, reason: 'Превышен лимит повторных отправок в час. Попробуйте позже.' };
  }

  return { allowed: true, currentResendCount };
}

async function recordOtpSent(consentId, otpHash) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRES_MS);
  const consent = await prisma.legalRepresentativeConsent.findUnique({ where: { id: consentId } });
  const lastResend = consent.lastResentAt ? new Date(consent.lastResentAt) : null;
  const lastHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const resendCount = (lastResend && lastResend > lastHourAgo) ? consent.resendCount + 1 : 1;

  return prisma.legalRepresentativeConsent.update({
    where: { id: consentId },
    data: {
      otpHash,
      otpSentAt: now,
      otpExpiresAt: expiresAt,
      status: 'OTP_SENT',
      resendCount,
      lastResentAt: now,
      attemptCount: 0,
      updatedAt: now
    }
  });
}

function canVerifyOtp(consent) {
  if (consent.status === 'CONFIRMED' || consent.status === 'REJECTED') {
    return { allowed: false, reason: 'Согласие уже подтверждено или отклонено.' };
  }
  if (consent.status === 'LOCKED') {
    return { allowed: false, reason: 'Слишком много неудачных попыток. Запросите новый код.' };
  }
  if (!consent.otpHash || !consent.otpExpiresAt) {
    return { allowed: false, reason: 'Нет активного кода. Запросите новый код.' };
  }
  if (isOtpExpired(consent)) {
    return { allowed: false, reason: 'Срок действия кода истёк. Получите новый код.' };
  }
  if (consent.attemptCount >= MAX_ATTEMPTS) {
    return { allowed: false, reason: 'Превышено количество попыток. Запросите новый код.' };
  }
  return { allowed: true };
}

async function recordFailedAttempt(consentId) {
  const consent = await prisma.legalRepresentativeConsent.findUnique({ where: { id: consentId } });
  const attempts = consent.attemptCount + 1;
  const status = attempts >= MAX_ATTEMPTS ? 'LOCKED' : consent.status;
  const now = new Date();
  return prisma.legalRepresentativeConsent.update({
    where: { id: consentId },
    data: {
      attemptCount: attempts,
      status,
      updatedAt: now
    }
  });
}

module.exports = {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  isOtpExpired,
  canSendOtp,
  recordOtpSent,
  canVerifyOtp,
  recordFailedAttempt,
  MAX_ATTEMPTS,
  OTP_EXPIRES_MS
};
