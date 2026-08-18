const nodemailer = require('nodemailer');

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : (port === 465);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'medium' });
}

async function sendPartnerAcceptanceEmail(to, details) {
  const transporter = createTransporter();
  const { id, acceptedAt, contractVersion, privacyVersion } = details;
  const baseUrl = process.env.PARTNER_BASE_URL || 'https://bloknotservis.ru';

  if (!transporter) {
    console.log('[EMAIL] Skipping partner acceptance email: SMTP is not configured.');
    return { sent: false, reason: 'SMTP not configured' };
  }

  const contractLink = `${baseUrl}/partner-offer.html?version=${encodeURIComponent(contractVersion.version)}`;
  const privacyLink = `${baseUrl}/partner-privacy.html?version=${encodeURIComponent(privacyVersion.version)}`;
  const offerHash = (contractVersion.hash || '').slice(0, 16) + '...';
  const privacyHash = (privacyVersion.hash || '').slice(0, 16) + '...';

  const subject = 'Подтверждение заключения Договора-оферты Bloknot';
  const text = `Здравствуйте!

Вы успешно зарегистрированы в качестве исполнителя Bloknot.

Договор-оферта заключён в электронной форме посредством акцепта.

Номер регистрации: ${id}
Дата и время акцепта: ${formatDate(acceptedAt)}
Версия Договора-оферты: ${contractVersion.version} (идентификатор: ${offerHash})
Версия Политики обработки ПД: ${privacyVersion.version} (идентификатор: ${privacyHash})

Ссылка на принятую версию договора: ${contractLink}
Ссылка на принятую версию политики: ${privacyLink}

Сохраните номер регистрации. Он позволяет идентифицировать вашу регистрацию и заключённый договор.

С уважением,
Bloknot`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
      <h2 style="color: #1b5e20;">Договор заключён</h2>
      <p>Вы успешно зарегистрированы в качестве исполнителя Bloknot.</p>
      <p>Договор-оферта заключён в электронной форме посредством акцепта.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p><strong>Номер регистрации:</strong> ${id}</p>
      <p><strong>Дата и время акцепта:</strong> ${formatDate(acceptedAt)}</p>
      <p><strong>Версия Договора-оферты:</strong> ${contractVersion.version} <span style="color: #666; font-family: monospace;">(идентификатор: ${offerHash})</span></p>
      <p><strong>Версия Политики обработки ПД:</strong> ${privacyVersion.version} <span style="color: #666; font-family: monospace;">(идентификатор: ${privacyHash})</span></p>
      <p><a href="${contractLink}" style="display: inline-block; margin: 8px 0; padding: 10px 16px; background: #007bff; color: #fff; text-decoration: none; border-radius: 6px;">Открыть Договор-оферту</a></p>
      <p><a href="${privacyLink}" style="display: inline-block; margin: 8px 0; padding: 10px 16px; background: #007bff; color: #fff; text-decoration: none; border-radius: 6px;">Открыть Политику обработки ПД</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #666; font-size: 13px;">Сохраните номер регистрации. Он позволяет идентифицировать вашу регистрацию и заключённый договор.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Bloknot" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html
    });
    console.log('[EMAIL] Partner acceptance email sent to', to);
    return { sent: true };
  } catch (error) {
    console.error('[EMAIL] Failed to send partner acceptance email:', error);
    return { sent: false, reason: error.message };
  }
}

function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU');
}

async function sendGuardianConsentLinkEmail(to, details) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('[EMAIL] Skipping guardian consent link email: SMTP is not configured.');
    return { sent: false, reason: 'SMTP not configured' };
  }

  const { link, minorName, minorBirthDate } = details;
  const subject = 'Подтверждение согласия законного представителя — Блокнот';
  const birthText = minorBirthDate ? formatDateShort(minorBirthDate) : '';

  const text = `Здравствуйте!

Для подтверждения согласия на заключение и исполнение гражданско-правового договора несовершеннолетним на сайте сервиса «Блокнот» перейдите по ссылке:
${link}

Несовершеннолетний: ${minorName}
Дата рождения: ${birthText}

Если вы не инициировали данную процедуру, проигнорируйте это письмо.

С уважением,
Блокнот
https://bloknotservis.ru/`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
      <h2 style="color: #1b5e20;">Подтверждение согласия законного представителя</h2>
      <p>Здравствуйте!</p>
      <p>Для подтверждения согласия перейдите по ссылке:</p>
      <p><a href="${link}" style="display: inline-block; margin: 8px 0; padding: 10px 16px; background: #007bff; color: #fff; text-decoration: none; border-radius: 6px;">Подтвердить согласие</a></p>
      <p>Несовершеннолетний: <strong>${minorName}</strong></p>
      <p>Дата рождения: <strong>${birthText}</strong></p>
      <p style="color: #666; font-size: 13px;">Если вы не инициировали данную процедуру, проигнорируйте это письмо.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Bloknot" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html
    });
    console.log('[EMAIL] Guardian consent link email sent to', to);
    return { sent: true };
  } catch (error) {
    console.error('[EMAIL] Failed to send guardian consent link email:', error);
    return { sent: false, reason: error.message };
  }
}

async function sendGuardianOtpEmail(to, details) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('[EMAIL] Skipping guardian OTP email: SMTP is not configured.');
    return { sent: false, reason: 'SMTP not configured' };
  }

  const { code, minorName, minorBirthDate } = details;
  const subject = 'Подтверждение согласия законного представителя — Блокнот';
  const birthText = minorBirthDate ? formatDateShort(minorBirthDate) : '';

  const text = `Здравствуйте!

Для подтверждения вашего согласия на заключение и исполнение гражданско-правового договора несовершеннолетним на сайте сервиса «Блокнот» введите следующий код:

${code}

Несовершеннолетний: ${minorName}
Дата рождения: ${birthText}

Код действует ограниченное время.

Если вы не инициировали данную процедуру, не вводите код и обратитесь в службу поддержки:
info@bloknotservis.ru

С уважением,
Блокнот
https://bloknotservis.ru/`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
      <h2 style="color: #1b5e20;">Подтверждение согласия законного представителя</h2>
      <p>Здравствуйте!</p>
      <p>Для подтверждения вашего согласия введите следующий код:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 12px 0;">${code}</p>
      <p>Несовершеннолетний: <strong>${minorName}</strong></p>
      <p>Дата рождения: <strong>${birthText}</strong></p>
      <p>Код действует ограниченное время.</p>
      <p style="color: #666; font-size: 13px;">Если вы не инициировали данную процедуру, не вводите код и обратитесь в службу поддержки: info@bloknotservis.ru</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Bloknot" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html
    });
    console.log('[EMAIL] Guardian OTP email sent to', to);
    return { sent: true };
  } catch (error) {
    console.error('[EMAIL] Failed to send guardian OTP email:', error);
    return { sent: false, reason: error.message };
  }
}

module.exports = {
  isEmailConfigured,
  sendPartnerAcceptanceEmail,
  sendGuardianConsentLinkEmail,
  sendGuardianOtpEmail
};
