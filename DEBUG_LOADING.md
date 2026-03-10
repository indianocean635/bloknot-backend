# 🔧 Диагностика проблем загрузки данных

## 🚨 **Что добавлено для отладки:**

### ✅ **Улучшенная обработка ошибок:**
- Подробные логи для каждого API запроса
- Проверка статуса ответа
- Отображение конкретных ошибок пользователю
- Try-catch для всех асинхронных операций

### 📋 **Что теперь проверяется:**
1. **Slug из URL** - правильный ли бизнес
2. **Business API** - отвечает ли сервер
3. **Branches API** - есть ли филиалы
4. **Services API** - есть ли услуги  
5. **Masters API** - есть ли специалисты

## 🧪 **Как диагностировать проблему:**

### **1. Откройте консоль (F12):**
Должны быть сообщения:
```
🚀 Booking form v3.0 - Step by Step
Current path: /book-template/your-slug
Extracted slug: your-slug
Loading booking data for slug: your-slug
Business response status: 200
Business data received: {...}
Loading branches, services, masters...
Branches response status: 200
Services response status: 200
Masters response status: 200
Data loaded successfully: {branches: X, services: Y, masters: Z}
```

### **2. Если есть ошибки - ищите красные сообщения:**
```
❌ Business API error: 404
❌ Branches API error: 500
❌ Services API error: 404
❌ Masters API error: 500
```

### **3. Проверьте сервер:**
```bash
pm2 logs --lines 20
```

## 🚨 **Возможные проблемы и решения:**

### **Проблема: "Business not found"**
- **Причина:** Неверный slug в URL
- **Решение:** Проверьте правильность ссылки
- **Проверка:** `curl "http://localhost:3000/api/public/business?slug=your-slug"`

### **Проблема: "Branches API error: 500"**
- **Причина:** Ошибка в серверном коде
- **Решение:** Проверьте логи PM2
- **Проверка:** `curl "http://localhost:3000/api/public/branches?slug=your-slug"`

### **Проблема: "Нет доступных услуг или специалистов"**
- **Причина:** В базе нет данных
- **Решение:** Добавьте услуги/специалистов в админке
- **Проверка:** Загляните в базу данных

### **Проблема: "Ошибка загрузки данных"**
- **Причина:** Сервер не отвечает
- **Решение:** Перезапустите PM2
- **Проверка:** `pm2 restart ecosystem.config.js`

## 🔧 **Быстрая проверка API:**

### **Проверьте все эндпоинты:**
```bash
# Бизнес
curl "http://localhost:3000/api/public/business?slug=your-slug"

# Филиалы
curl "http://localhost:3000/api/public/branches?slug=your-slug"

# Услуги
curl "http://localhost:3000/api/public/services?slug=your-slug"

# Специалисты
curl "http://localhost:3000/api/public/masters?slug=your-slug"
```

### **Ожидаемый ответ:**
```json
{
  "name": "Название бизнеса",
  "address": "Адрес",
  "logo": "/uploads/works/..."
}
```

## 📱 **Тестирование в браузере:**

### **1. Откройте DevTools:**
- F12 → Console
- F12 → Network (вкладка)

### **2. Перезагрузите страницу:**
- Посмотрите на Network вкладку
- Должны быть запросы к API
- Проверьте статусы ответов

### **3. Проверьте slug:**
- Убедитесь что URL правильный
- Slug должен быть после последнего слэша

## 🎯 **Что делать если проблема осталась:**

### **Шаг 1: Проверьте консоль**
- Откройте F12
- Найдите красные ошибки
- Пришлите скриншот консоли

### **Шаг 2: Проверьте сервер**
```bash
pm2 status
pm2 logs --lines 10
```

### **Шаг 3: Проверьте API**
```bash
curl "http://localhost:3000/api/public/business?slug=your-slug"
```

### **Шаг 4: Проверьте базу**
- Есть ли у бизнеса услуги
- Есть ли у бизнеса специалисты
- Есть ли у бизнеса филиалы

## 📋 **Ожидаемый результат после исправления:**

- ✅ **Нет ошибок в консоли**
- ✅ **Все API отвечают 200**
- ✅ **Данные загружаются**
- ✅ **Появляется первый шаг** (филиалы или услуги)

**Теперь ошибки будут показываться подробно! Проверьте консоль и пришлите скриншот если есть проблемы.** 🔧
