# Bloknot — production запуск (1 сервер Ubuntu)

Цель: поднять Bloknot на одном сервере (Ubuntu) в Yandex Cloud так, чтобы:

- backend (Node.js/Express) раздаёт **API** (`/api/*`) и **статический frontend**
- PostgreSQL хранит данные (в РФ, на том же сервере)
- uploads (аватары/фото работ) хранятся на диске сервера

Домен (production): `https://bloknotservis.ru`

---

## 1) Структура проекта (рекомендуемая)

В проде проще всего держать frontend как статику внутри backend.

1. Создайте папку:

```bash
bloknot-backend/public
```

2. Скопируйте **все файлы** из текущего `bloknot-frontend/` в `bloknot-backend/public/`:

- `*.html`
- `styles.css`
- `app.js`

После этого backend будет раздавать сайт по корню (`/dashboard.html`, `/calendar.html`, `/booking.html` и т.д.).

Uploads хранятся в `bloknot-backend/uploads/` и раздаются по URL `/uploads/...`.

---

## 2) Переменные окружения (.env)

В папке `bloknot-backend/`:

```bash
cp .env.example .env
nano .env
```

Минимально нужно заполнить:

- `DATABASE_URL`
- `PORT` (можно оставить `3001`)
- `BASE_URL=https://bloknotservis.ru`

Примечания:

- `FRONTEND_PATH` обычно не нужен, если фронт лежит в `./public`.
- `UPLOADS_PATH` обычно не нужен, если uploads лежат в `./uploads`.

---

## 3) Установка зависимостей на сервере

### Node.js
Рекомендуется Node.js LTS (18/20).

### PostgreSQL
Установите PostgreSQL и создайте БД/пользователя.

Пример (идея, команды могут отличаться по дистрибутиву):

```sql
CREATE USER bloknot_user WITH PASSWORD 'strong_password';
CREATE DATABASE bloknot OWNER bloknot_user;
```

`DATABASE_URL` пример:

```
postgresql://bloknot_user:strong_password@127.0.0.1:5432/bloknot?schema=public
```

---

## 4) Prisma (обязательно)

В папке `bloknot-backend/`:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
```

- `generate` нужен для Prisma Client
- `migrate deploy` применяет миграции в production

---

## 5) Запуск backend

В папке `bloknot-backend/`:

```bash
npm run start
```

Для разработки локально:

```bash
npm run dev
```

---

## 6) Nginx (рекомендуется)

Схема:

- Nginx принимает запросы на 80/443
- проксирует на Node.js: `http://127.0.0.1:3001`

Минимальный server block (пример):

```nginx
server {
  server_name bloknotservis.ru;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

TLS (HTTPS) можно выпустить через certbot.

---

## 7) Обновление через Git

Рекомендуемый flow:

1. На сервере один раз:

```bash
git clone <your-repo-url>
```

2. При обновлении:

```bash
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
# перезапустить процесс (pm2/systemd)
```

---

## 8) Автозапуск (systemd) — рекомендуется

Чтобы backend запускался сам после перезагрузки сервера.

1. Создайте файл (пример пути):

```bash
sudo nano /etc/systemd/system/bloknot.service
```

2. Вставьте (замени пути под свой сервер):

```ini
[Unit]
Description=Bloknot Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/bloknot/bloknot-backend
EnvironmentFile=/var/www/bloknot/bloknot-backend/.env
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

3. Примените:

```bash
sudo systemctl daemon-reload
sudo systemctl enable bloknot
sudo systemctl start bloknot
sudo systemctl status bloknot
```

Логи:

```bash
journalctl -u bloknot -f
```

---

## 9) Про важное (production)

- Не коммитьте `.env`
- Uploads (`uploads/`) не должны теряться при деплое
  - либо хранить их на диске и не трогать

