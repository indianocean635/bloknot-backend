const { prisma } = require("../services/prismaService");

// Функция для парсинга даты
function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Получить записи (защищенные)
async function getAppointments(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.businessId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const { from, to, masterId } = req.query;
  const where = { businessId: user.businessId };

  const fromDate = from ? parseDate(from) : null;
  const toDate = to ? parseDate(to) : null;

  if (fromDate || toDate) {
    where.startsAt = {};
    if (fromDate) where.startsAt.gte = fromDate;
    if (toDate) where.startsAt.lte = toDate;
  }
  if (masterId) where.masterId = Number(masterId);

  const items = await prisma.appointment.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: { service: true, master: true, branch: true },
  });

  res.json(items);
}

// Получить записи (публичные)
async function getPublicAppointments(req, res) {
  const { from, to, masterId } = req.query;
  const where = { businessId: req.business.id };

  const fromDate = from ? parseDate(from) : null;
  const toDate = to ? parseDate(to) : null;

  if (fromDate || toDate) {
    where.startsAt = {};
    if (fromDate) where.startsAt.gte = fromDate;
    if (toDate) where.startsAt.lte = toDate;
  }
  if (masterId) where.masterId = Number(masterId);

  const items = await prisma.appointment.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: { service: true, master: true, branch: true },
  });

  res.json(items);
}

// Создать запись (публичная)
async function createAppointment(req, res) {
  const { customerName, customerPhone, startsAt, serviceId, masterId, branchId } = req.body;

  if (!customerName || !startsAt || !serviceId || !masterId) {
    return res.status(400).json({ error: "Заполните клиента, услугу, мастера и время" });
  }

  const start = parseDate(startsAt);
  if (!start) {
    return res.status(400).json({ error: "Некорректная дата" });
  }

  const service = await prisma.service.findFirst({ where: { id: Number(serviceId), businessId: req.business.id } });
  if (!service) {
    return res.status(400).json({ error: "Услуга не найдена" });
  }

  const durationMs = Number(service.duration) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  const sid = Number(masterId);
  const overlap = await prisma.appointment.findFirst({
    where: {
      businessId: req.business.id,
      masterId: sid,
      AND: [{ startsAt: { lt: end } }, { endsAt: { gt: start } }],
    },
  });
  if (overlap) {
    return res.status(409).json({ error: "У мастера уже есть запись на это время" });
  }

  const item = await prisma.appointment.create({
    data: {
      businessId: req.business.id,
      customerName: String(customerName),
      customerPhone: customerPhone ? String(customerPhone) : null,
      startsAt: start,
      endsAt: end,
      priceAtBooking: Number(service.price),
      serviceId: Number(serviceId),
      masterId: sid,
      branchId: branchId ? Number(branchId) : null,
    },
    include: { service: true, master: true, branch: true },
  });

  res.json(item);
}

// Удалить запись
async function deleteAppointment(req, res) {
  const id = Number(req.params.id);
  await prisma.appointment.delete({ where: { id } });
  res.json({ ok: true });
}

// Получить одну запись
async function getAppointmentById(req, res) {
  const id = Number(req.params.id);
  const where = { businessId: req.business.id };
  
  if (req.query.branchId) {
    where.branchId = Number(req.query.branchId);
  }
  if (req.query.serviceId) {
    where.serviceId = Number(req.query.serviceId);
  }
  where.id = id;

  const item = await prisma.appointment.findFirst({
    where,
    include: { service: true, master: true, branch: true },
  });

  res.json(item);
}

module.exports = {
  getAppointments,
  getPublicAppointments,
  createAppointment,
  deleteAppointment,
  getAppointmentById
};
