# 📱 Обновление WhatsApp интеграции - Новый шаблон Meta

## ✅ Что обновлено

### **1. Имя шаблона**
- **Старое:** `booking_confirmation` 
- **Новое:** `booking_confirmation_simple`
- **Статус:** ✅ Уже обновлено в коде

### **2. Переменные шаблона (6 штук)**
1. `customer_name` - имя клиента
2. `date` - дата записи  
3. `time` - время записи
4. `specialist` - имя специалиста
5. `service` - название услуги
6. `booking_link` - ссылка на запись бизнеса

### **3. Логика booking_link**
```javascript
// Автоматически генерируется из slug бизнеса
const domain = process.env.DOMAIN || process.env.FRONTEND_URL || 'https://bloknotservis.ru';
const bookingLink = `${domain}/book/${fullBooking.business?.slug}`;
```

## 🔧 Добавленные debug логи

### **В appointmentController.js:**
```
[WHATSAPP TEMPLATE NAME] booking_confirmation_simple
[WHATSAPP BOOKING LINK] https://bloknotservis.ru/book/business-slug
[WHATSAPP VARIABLES] {"customer_name":"Иван","date":"15.06.2026",...}
[WHATSAPP VARIABLES COUNT] 6
[WHATSAPP TEMPLATE] ALL 6 VARIABLES PRESENT ✅
[WHATSAPP TEMPLATE] customer_name: Иван
[WHATSAPP TEMPLATE] date: 15.06.2026
[WHATSAPP TEMPLATE] time: 14:30
[WHATSAPP TEMPLATE] specialist: Анна
[WHATSAPP TEMPLATE] service: Стрижка
[WHATSAPP TEMPLATE] booking_link: https://bloknotservis.ru/book/slug
```

### **В whatsappService.js:**
```
[WHATSAPP TEMPLATE] BODY PARAMETERS COUNT: 6
[WHATSAPP TEMPLATE] BODY PARAMETERS: [{"type":"text","text":"Иван"},...]
[WHATSAPP TEMPLATE] CORRECT TEMPLATE NAME IN PAYLOAD ✅: booking_confirmation_simple
[WHATSAPP TEMPLATE] CORRECT LANGUAGE CODE ✅: ru
[WHATSAPP TEMPLATE PAYLOAD FULL] {"messaging_product":"whatsapp",...}
```

## 📋 Структура payload

```json
{
  "messaging_product": "whatsapp",
  "to": "1234567890",
  "type": "template",
  "template": {
    "name": "booking_confirmation_simple",
    "language": {"code": "ru"},
    "components": [
      {
        "type": "body",
        "parameters": [
          {"type": "text", "text": "Иван"},
          {"type": "text", "text": "15.06.2026"},
          {"type": "text", "text": "14:30"},
          {"type": "text", "text": "Анна"},
          {"type": "text", "text": "Стрижка"},
          {"type": "text", "text": "https://bloknotservis.ru/book/slug"}
        ]
      }
    ]
  }
}
```

## 🚀 Как применить изменения

### **На сервере:**
```bash
# 1. Обновить код
git pull origin main

# 2. Перезапустить приложение
pm2 restart bloknot

# 3. Проверить логи
pm2 logs bloknot --lines 50
```

## 🧪 Тестирование

### **1. Создайте тестовую запись:**
- Перейдите на страницу бронирования
- Заполните форму с телефоном
- Создайте запись

### **2. Проверьте логи:**
```bash
pm2 logs bloknot | grep WHATSAPP
```

### **3. Ожидаемые результаты:**
- ✅ Все 6 переменных присутствуют
- ✅ Правильное имя шаблона `booking_confirmation_simple`
- ✅ Корректная ссылка на запись бизнеса
- ✅ Payload содержит 6 параметров

## 🔍 Проверка работы

### **В логах должно быть:**
```
[WHATSAPP TEMPLATE] ALL 6 VARIABLES PRESENT ✅
[WHATSAPP TEMPLATE] CORRECT TEMPLATE NAME IN PAYLOAD ✅: booking_confirmation_simple
[WHATSAPP TEMPLATE] BODY PARAMETERS COUNT: 6
```

### **Если есть ошибки:**
```
[WHATSAPP TEMPLATE] MISSING VARIABLES: ["booking_link"]
[WHATSAPP TEMPLATE] WRONG TEMPLATE NAME IN PAYLOAD: booking_confirmation
```

## 📞 Telegram интеграция

**Не затронута!** Telegram бот работает как раньше без изменений.

## ⚠️ Важно

- Шаблон `booking_confirmation_simple` должен быть активен в Meta
- Все 6 переменных должны быть добавлены в шаблон в Meta
- WhatsApp должен быть включен (`WHATSAPP_ENABLED=true`)
- Токен и Phone ID должны быть настроены

## 🎯 Готово к тестированию!

Все изменения применены:
- ✅ Имя шаблона обновлено
- ✅ 6 переменных добавлены  
- ✅ Debug логи добавлены
- ✅ Payload проверен
- ✅ Booking link автоматический

**Перезапустите pm2 и тестируйте! 🚀**
