// Временное хранилище в памяти
const memoryAppointments = new Map();
const memoryUsers = new Map();
let appointmentId = 1;

// Функция для парсинга даты
function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Получить записи (защищенные)
async function getAppointments(req, res) {
  try {
    // Временная проверка пользователя
    const user = memoryUsers.get(req.user?.id) || {
      id: req.user?.id || 'user_1',
      businessId: 'business_1'
    };
    
    if (!user || !user.businessId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const { from, to, masterId } = req.query;
    
    // Фильтруем записи из памяти
    let items = Array.from(memoryAppointments.values()).filter(item => 
      item.businessId === user.businessId
    );
    
    // Фильтры по дате
    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to) : null;
    
    if (fromDate) {
      items = items.filter(item => new Date(item.startsAt) >= fromDate);
    }
    if (toDate) {
      items = items.filter(item => new Date(item.startsAt) <= toDate);
    }
    if (masterId) {
      items = items.filter(item => item.masterId === Number(masterId));
    }
    
    // Сортировка
    items.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    
    res.json(items);
  } catch (error) {
    console.error('❌ getAppointments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Получить записи (публичные)
async function getPublicAppointments(req, res) {
  try {
    const { from, to, masterId } = req.query;
    const businessId = req.business?.id || 'business_1';
    
    let items = Array.from(memoryAppointments.values()).filter(item => 
      item.businessId === businessId
    );
    
    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to) : null;
    
    if (fromDate) {
      items = items.filter(item => new Date(item.startsAt) >= fromDate);
    }
    if (toDate) {
      items = items.filter(item => new Date(item.startsAt) <= toDate);
    }
    if (masterId) {
      items = items.filter(item => item.masterId === Number(masterId));
    }
    
    items.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    
    res.json(items);
  } catch (error) {
    console.error('❌ getPublicAppointments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Создать запись
async function createAppointment(req, res) {
  try {
    const appointment = {
      id: appointmentId++,
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    memoryAppointments.set(appointment.id, appointment);
    
    console.log('✅ Appointment created:', appointment.id);
    res.json(appointment);
  } catch (error) {
    console.error('❌ createAppointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Обновить запись
async function updateAppointment(req, res) {
  try {
    const { id } = req.params;
    const appointment = memoryAppointments.get(Number(id));
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    const updated = { ...appointment, ...req.body, updatedAt: new Date() };
    memoryAppointments.set(Number(id), updated);
    
    console.log('✅ Appointment updated:', id);
    res.json(updated);
  } catch (error) {
    console.error('❌ updateAppointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Удалить запись
async function deleteAppointment(req, res) {
  try {
    const { id } = req.params;
    const appointment = memoryAppointments.get(Number(id));
    
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    
    memoryAppointments.delete(Number(id));
    
    console.log('✅ Appointment deleted:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ deleteAppointment error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = {
  getAppointments,
  getPublicAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment
};
