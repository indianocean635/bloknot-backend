# 🚀 Развертывание фронтенда на сервере

## 📋 **Текущая ситуация:**
- ✅ Backend работает на порту 3001
- ❌ Фронтенд не настроен на сервере
- ❌ IP адрес показывает "Cannot GET /"

## 🎯 **Что нужно сделать:**

### **Шаг 1: Скопировать фронтенд на сервер**

**На локальном компьютере:**
```bash
# Создайте архив с папкой public
cd c:\Users\User\Desktop\bloknot-backend
tar -czf frontend.tar.gz public/

# Или через ZIP
# Сожмите папку public в frontend.zip
```

### **Шаг 2: Загрузить на сервер**

**На сервере (185.10.187.195):**
```bash
# Перейдите в папку проекта
cd /var/www/bloknot-backend

# Загрузите и распакуйте фронтенд
# scp frontend.tar.gz user@185.10.187.195:/var/www/bloknot-backend/
# tar -xzf frontend.tar.gz

# Или создайте папку вручную
mkdir -p /var/www/bloknot-frontend
cp -r /var/www/bloknot-backend/public/* /var/www/bloknot-frontend/
```

### **Шаг 3: Настроить Nginx**

**Создайте конфигурацию:**
```bash
sudo nano /etc/nginx/sites-available/bloknot
```

**Вставьте этот конфиг:**
```nginx
server {
    listen 80;
    server_name 185.10.187.195;

    # Фронтенд
    root /var/www/bloknot-frontend;
    index index.html;

    # Обработка SPA маршрутов
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Проксирование API на бэкенд
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Статические файлы
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### **Шаг 4: Активировать конфигурацию**

```bash
# Активируем сайт
sudo ln -s /etc/nginx/sites-available/bloknot /etc/nginx/sites-enabled/

# Удаляем стандартный конфиг если есть
sudo rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
sudo nginx -t

# Перезапускаем Nginx
sudo systemctl restart nginx
```

### **Шаг 5: Проверяем результат**

**Откройте в браузере:**
- http://185.10.187.195 - должен показать сайт
- http://185.10.187.195/api/health - должен показать API статус

## 🌐 **Структура после развертывания:**

```
/var/www/
├── bloknot-backend/     # Backend (Node.js)
│   ├── index.js
│   ├── controllers/
│   ├── routes/
│   └── services/
├── bloknot-frontend/    # Frontend (статические файлы)
│   ├── index.html       # Главный сайт
│   ├── admin.html       # Админ-панель
│   ├── booking-form.html # Форма записи
│   ├── dashboard.html   # Дашборд
│   ├── settings.html    # Настройки
│   ├── styles.css       # Стили
│   └── app.js          # JavaScript
```

## 📱 **Какие страницы будут доступны:**

- **http://185.10.187.195** - Главный сайт
- **http://185.10.187.195/admin.html** - Админ-панель
- **http://185.10.187.195/dashboard.html** - Дашборд
- **http://185.10.187.195/booking-form.html** - Форма записи

## 🔧 **Если что-то не работает:**

### **Проверьте Nginx:**
```bash
sudo nginx -t
sudo systemctl status nginx
sudo journalctl -u nginx
```

### **Проверьте API:**
```bash
curl http://localhost:3001/health
curl http://185.10.187.195/api/health
```

### **Проверьте права доступа:**
```bash
sudo chown -R www-data:www-data /var/www/bloknot-frontend
sudo chmod -R 755 /var/www/bloknot-frontend
```

## 🎯 **Ожидаемый результат:**

После этих шагов:
- ✅ Сайт откроется по IP адресу
- ✅ Админ-панель будет работать
- ✅ API будет проксироваться корректно
- ✅ Все страницы будут доступны

**Выполните эти шаги на сервере и сайт снова заработает!** 🚀
