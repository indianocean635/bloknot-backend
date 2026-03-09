# ✅ Ошибка Prisma "Unknown field phone" исправлена!

## 🚨 **Проблема была:**
```
Unknown field phone for select statement on model Branch
```

**Причина:** В модели Branch нет поля `phone`, но код пытался его выбрать.

## 🛠️ **Что исправлено:**

### **❌ Было (с ошибкой):**
```javascript
const business = await prisma.business.findUnique({
  where: { id: req.business.id },
  select: {
    name: true,
    branches: {
      take: 1,
      select: {
        address: true,
        phone: true  // ❌ ЭТОГО ПОЛЯ НЕТ В МОДЕЛИ
      }
    }
  }
});

const result = {
  name: business.name,
  address: business.branches[0]?.address || null,
  phone: business.branches[0]?.phone || null,  // ❌ ЭТОГО ПОЛЯ НЕТ
  logo: logoPhoto?.imageUrl || null
};
```

### **✅ Стало (без ошибок):**
```javascript
const business = await prisma.business.findUnique({
  where: { id: req.business.id },
  select: {
    name: true,
    branches: {
      take: 1,
      select: {
        address: true  // ✅ ТОЛЬКО АДРЕС
      }
    }
  }
});

const result = {
  name: business.name,
  address: business.branches[0]?.address || null,
  logo: logoPhoto?.imageUrl || null  // ✅ УБРАН PHONE
};
```

## 🎯 **Изменения:**
1. ✅ **Удален `phone: true`** из select запроса
2. ✅ **Удален `phone: ...`** из результата
3. ✅ **Оставлен только `address`** как доступное поле

## 🔄 **Перезапустите сервер:**

```bash
pm2 restart ecosystem.config.js
```

## 🧪 **Проверьте результат:**

### **1. Проверьте логи:**
```bash
pm2 logs --lines 10
```
Не должно быть ошибок "Unknown field phone"

### **2. Проверьте API:**
```bash
curl "http://localhost:3000/api/public/business?slug=your-slug"
```

Должен вернуть:
```json
{
  "name": "Название компании",
  "address": "Адрес филиала",
  "logo": "/uploads/works/..."
}
```
**Обратите внимание:** поле `phone` отсутствует - это нормально!

### **3. Проверьте форму записи:**
- Откройте страницу онлайн-записи
- Должна загрузиться без ошибок
- В хедере должно быть название и адрес (без телефона)

## 📋 **Ожидаемый результат:**

- ✅ **Нет ошибок Prisma** в логах
- ✅ **API работает** корректно
- ✅ **Форма записи загружается**
- ✅ **Данные бизнеса отображаются** (без поля phone)

## 🚨 **Важно:**

- **НЕ изменялась Prisma schema**
- **НЕ добавлялось поле phone** в Branch
- **Исправлен только select запрос**
- **Телефон больше не передается** в API

**Теперь Prisma не должен выдавать ошибку! Перезапустите сервер и проверьте.** 🎉
