# Bloknot Backend - Текущее состояние проекта
**Дата:** 27 мая 2026
**Версия бэкапа:** v1.0-backup-complete
**Git commit:** 91497cf

## 📋 Общее описание

Bloknot - сервис онлайн-записи клиентов с Progressive Web App (PWA) поддержкой для Android и iOS.

## 🏗️ Архитектура

### Backend (Node.js + Express)
- **Фреймворк:** Express.js
- **База данных:** PostgreSQL через Prisma ORM
- **Аутентификация:** JWT токены (срок действия 90 дней)
- **Хранение файлов:** S3 совместимое хранилище (Selectel)
- **Telegram бот:** Telegraf для уведомлений и записей через Telegram

### Frontend
- **Технологии:** HTML, CSS, JavaScript (vanilla)
- **PWA:** Service Worker для оффлайн работы
- **Адаптивность:** Мобильная версия для всех устройств

## 🔐 Система аутентификации

### Magic Link (вход по email)
- Пользователь вводит email
- Ссылка для входа отправляется на email
- При клике создается JWT токен на 90 дней
- Токен сохраняется в httpOnly cookie

### Вход по паролю
- Пользователь может установить пароль
- Логин/пароль через email и пароль
- Также создает JWT токен на 90 дней

### Telegram авторизация
- Команда `/start` с токеном бизнеса
- Автоматическая регистрация через Telegram
- Запись через бота

### PWA аутентификация
- Service Worker кеширует статические файлы
- При открытии PWA проверяется auth cookie
- Если cookie валиден - редирект в кабинет
- Если нет - показ формы входа

## 📱 PWA (Progressive Web App)

### Manifest
- **start_url:** `/dashboard.html` - открывает сразу кабинет
- **display:** standalone - как нативное приложение
- **theme_color:** #22c55e (зеленый)
- **Icons:** SVG иконки 192x192 и 512x512

### Service Worker
- **Cache version:** v6
- **Стратегия:** Network-first для HTML и JS, Cache-first для статических файлов
- **API вызовы:** не кешируются
- **Auth flows:** не кешируются

### Установка
- Android Chrome: "Add to Home Screen"
- iOS Safari: "Add to Home Screen"
- Автоматическое обновление при изменении cache version

## 🗄️ База данных (Prisma)

### Основные модели
- **User:** Пользователи (email, пароль, роль)
- **Business:** Бизнесы (название, slug, владелец)
- **Service:** Услуги (название, цена, длительность)
- **Master:** Мастера/специалисты
- **Appointment:** Записи клиентов
- **WorkPhoto:** Фото работ
- **Branch:** Филиалы бизнеса

### Отношения
- User → Business (один-к-одному для владельца)
- Business → Services (один-ко-многим)
- Business → Masters (один-ко-многим)
- Business → Appointments (один-ко-многим)
- Master → Appointments (один-ко-многим)

## 🤖 Telegram Bot

### Функции
- `/start <token>` - присоединение к бизнесу
- Выбор услуги
- Выбор мастера
- Выбор даты и времени
- Подтверждение записи
- Отмена записи
- Напоминания (24ч и 1ч до записи)

### Webhook
- Уведомления о новых записях
- Уведомления об отменах
- Интеграция с бизнес-логикой

## 📁 Структура проекта

```
bloknot-backend/
├── controllers/          # Контроллеры бизнес-логики
│   ├── authController.js
│   ├── magicLinkController.js
│   ├── appointmentController.js
│   ├── businessController.js
│   └── uploadController.js
├── middleware/          # Middleware для Express
│   ├── magicAuthMiddleware.js
│   └── simpleAuthMiddleware.js
├── routes/             # API роуты
│   ├── authRoutes.js
│   ├── appointmentRoutes.js
│   ├── businessRoutes.js
│   └── uploadRoutes.js
├── services/           # Сервисы
│   ├── prismaService.js
│   ├── telegramBotService.js
│   └── emailService.js
├── public/            # Frontend файлы
│   ├── index.html     # Главная страница
│   ├── dashboard.html # Кабинет
│   ├── settings.html  # Настройки
│   ├── calendar.html  # Календарь
│   ├── app.js         # Основной JS
│   ├── sw.js          # Service Worker
│   └── manifest.webmanifest
└── prisma/            # Prisma схема
    └── schema.prisma
```

## 🔧 Ключевые настройки

### Environment Variables
- `JWT_SECRET` - секрет для JWT токенов
- `DATABASE_URL` - строка подключения к PostgreSQL
- `S3_*` - настройки S3 хранилища
- `TELEGRAM_BOT_TOKEN` - токен Telegram бота
- `SMTP_*` - настройки email (Yandex)

### PM2
- Процесс: `bloknot` (cluster mode)
- Telegram бот: `telegram`
- Автозапуск при перезагрузке сервера

## 🎯 Реализованные функции

### Для пользователей
- Регистрация через email (magic link)
- Вход по паролю
- Создание бизнеса
- Управление услугами
- Управление мастерами
- Календарь записей
- Настройки профиля
- Загрузка фото работ

### Для клиентов
- Онлайн запись через публичную ссылку
- Запись через Telegram бота
- Напоминания о записях
- Отмена записей

### PWA
- Установка на главный экран
- Оффлайн работа (кеширование)
- Сохранение авторизации 90 дней
- Авто-редирект в кабинет при входе

## 🐛 Недавние исправления

### PWA авторизация (27 мая 2026)
- **Проблема:** PWA на Android/iOS каждый раз просил логин
- **Решение:** 
  - Обновлен cache service worker (v5 → v6)
  - start_url изменен на `/dashboard.html`
  - Добавлен редирект на login если не авторизован
  - Проверка auth cookie при загрузке
- **Результат:** Авторизация сохраняется 90 дней

### Footer (предыдущие изменения)
- Удалена ссылка "База знаний" со всех страниц
- Добавлен единый footer на страницы ЛК (dashboard, settings, calendar)
- Копирование email в буфер обмена

## 📊 Статус

- ✅ PWA работает корректно
- ✅ Авторизация сохраняется 90 дней
- ✅ Telegram бот активен
- ✅ Email уведомления работают
- ✅ Загрузка файлов на S3 работает
- ✅ База данных стабильна

## 🔗 Важные ссылки

- **GitHub:** https://github.com/indianocean635/bloknot-backend.git
- **Продакшн:** https://bloknotservis.ru
- **Админка:** https://bloknotservis.ru/admin
- **API:** https://bloknotservis.ru/api

## 📝 Примечания

- Node.js версия: 20.20.1 (предупреждение о переходе на 22+ в 2027)
- PM2 управляет процессами
- Git тег v1.0-backup-complete создан для отката
- Все изменения закоммичены и запушены в main
