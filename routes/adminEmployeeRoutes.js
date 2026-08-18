const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const { logAdminAction } = require('../services/auditService');
const { prisma } = require('../services/prismaService');
const { getSignedUrlForFile } = require('../lib/s3');

const router = express.Router();

const EMPLOYEE_LIST_SELECT = {
  id: true,
  lastName: true,
  firstName: true,
  middleName: true,
  birthDate: true,
  phone: true,
  email: true,
  inn: true,
  isNpdPayer: true,
  region: true,
  telegram: true,
  bankDetails: true,
  status: true,
  acceptedAt: true,
  createdAt: true,
  contractVersion: {
    select: { id: true, version: true, title: true, hash: true }
  },
  privacyVersion: {
    select: { id: true, version: true, title: true, hash: true }
  }
};

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function dateFilter(field, from, to) {
  const where = {};
  if (from) where.gte = from;
  if (to) where.lte = to;
  return Object.keys(where).length ? { [field]: where } : undefined;
}

function buildWhere(query) {
  const where = {};
  const search = (query.search || '').trim();
  const inn = (query.inn || '').trim();
  const phone = (query.phone || '').trim();
  const email = (query.email || '').trim().toLowerCase();
  const status = (query.status || '').trim();
  const isNpdPayer = query.isNpdPayer;
  const dateFrom = parseDate(query.dateFrom);
  const dateTo = parseDate(query.dateTo);
  const contractVersion = (query.contractVersion || '').trim();

  if (search) {
    where.OR = [
      { lastName: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { middleName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }
  if (inn) where.inn = { contains: inn };
  if (phone) where.phone = { contains: phone };
  if (email) where.email = { contains: email, mode: 'insensitive' };
  if (status) where.status = status;
  if (isNpdPayer !== undefined && isNpdPayer !== '') where.isNpdPayer = isNpdPayer === 'true';
  if (contractVersion) where.contractVersion = { version: contractVersion };

  const createdFilter = dateFilter('createdAt', dateFrom, dateTo);
  if (createdFilter) Object.assign(where, createdFilter);

  return where;
}

function buildOrderBy(query) {
  const sort = query.sort || 'createdAt_desc';
  const [field, dir] = sort.split('_');
  const allowed = ['createdAt', 'acceptedAt', 'lastName', 'firstName', 'status'];
  const order = dir === 'asc' ? 'asc' : 'desc';
  if (!allowed.includes(field)) return { createdAt: 'desc' };

  // For name sorting, combine lastName and firstName
  if (field === 'lastName') {
    return { lastName: order };
  }
  return { [field]: order };
}

// List employees with search, filters and sorting
router.get('/', requireAuth, requirePermission('employees_data.view'), async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const orderBy = buildOrderBy(req.query);
    const take = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const skip = parseInt(req.query.offset, 10) || 0;

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy,
        take,
        skip,
        select: EMPLOYEE_LIST_SELECT
      }),
      prisma.employee.count({ where })
    ]);

    res.json({ success: true, employees, total, take, skip });
  } catch (error) {
    console.error('[ADMIN EMPLOYEES LIST]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export employees to CSV
router.get('/export', requireAuth, requirePermission('employees_data.export'), async (req, res) => {
  try {
    const where = buildWhere(req.query);
    const employees = await prisma.employee.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        ...EMPLOYEE_LIST_SELECT,
        ipAddress: true,
        userAgent: true,
        acceptedOffer: true,
        acceptedNpd: true,
        acceptedPrivacy: true,
        acceptedDataCorrect: true
      }
    });

    await logAdminAction({
      adminId: req.user.id,
      action: 'export',
      entity: 'employee',
      metadata: { filters: req.query, count: employees.length }
    });

    const headers = ['ID', 'Фамилия', 'Имя', 'Отчество', 'Дата рождения', 'Телефон', 'Email', 'ИНН', 'НПД', 'Регион', 'Telegram', 'Банковские реквизиты', 'Статус', 'Дата акцепта', 'Дата регистрации', 'Версия договора', 'IP', 'User-Agent'];
    const rows = employees.map(e => [
      e.id,
      e.lastName,
      e.firstName,
      e.middleName || '',
      e.birthDate ? e.birthDate.toISOString().split('T')[0] : '',
      e.phone,
      e.email,
      e.inn,
      e.isNpdPayer ? 'Да' : 'Нет',
      e.region,
      e.telegram || '',
      e.bankDetails,
      e.status,
      e.acceptedAt ? e.acceptedAt.toISOString() : '',
      e.createdAt ? e.createdAt.toISOString() : '',
      e.contractVersion ? e.contractVersion.version : '',
      e.ipAddress,
      e.userAgent
    ]);

    const csv = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const filename = `employees_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('[ADMIN EMPLOYEES EXPORT]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single employee details
router.get('/:id', requireAuth, requirePermission('employees_data.view'), async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        contractVersion: true,
        privacyVersion: true,
        acceptance: true,
        guardianConsent: true,
        minorPrivacyConsent: true,
        minorContractAcceptance: true,
        documents: true,
        consentEvents: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await logAdminAction({
      adminId: req.user.id,
      action: 'view',
      entity: 'employee',
      entityId: id,
      metadata: { email: employee.email, inn: employee.inn }
    });

    res.json({ success: true, employee });
  } catch (error) {
    console.error('[ADMIN EMPLOYEE GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update employee status (and other admin-editable fields)
router.put('/:id', requireAuth, requirePermission('employees_data.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body || {};

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const updateData = {};
    const allowedStatuses = ['ACCEPTED', 'PENDING', 'REJECTED', 'ARCHIVED', 'OTP_SENT', 'CONFIRMED', 'GUARDIAN_CONSENT_CONFIRMED', 'PRIVACY_CONSENT_CONFIRMED', 'OFFER_ACCEPTED', 'LOCKED'];
    if (status && allowedStatuses.includes(status)) updateData.status = status;

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        contractVersion: { select: { id: true, version: true } }
      }
    });

    await logAdminAction({
      adminId: req.user.id,
      action: 'edit',
      entity: 'employee',
      entityId: id,
      metadata: { updatedFields: Object.keys(updateData) }
    });

    res.json({ success: true, employee });
  } catch (error) {
    console.error('[ADMIN EMPLOYEE UPDATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a signed URL for a private document
router.get('/:id/document/:docId', requireAuth, requirePermission('employees_data.view'), async (req, res) => {
  try {
    const { id, docId } = req.params;
    const doc = await prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId: id }
    });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const signedUrl = await getSignedUrlForFile(doc.s3Key, 900);

    await logAdminAction({
      adminId: req.user.id,
      action: 'view_document',
      entity: 'employee_document',
      entityId: docId,
      metadata: { employeeId: id, documentType: doc.type }
    });

    res.json({ success: true, signedUrl, fileName: doc.fileName });
  } catch (error) {
    console.error('[ADMIN DOCUMENT SIGNED URL]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete employee record
router.delete('/:id', requireAuth, requirePermission('employees_data.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    await prisma.employee.delete({ where: { id } });

    await logAdminAction({
      adminId: req.user.id,
      action: 'delete',
      entity: 'employee',
      entityId: id,
      metadata: { email: existing.email, inn: existing.inn }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN EMPLOYEE DELETE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
