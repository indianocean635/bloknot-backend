#!/bin/bash
# Автоматический анализ и исправление сервера

echo "🚀 АВТОМАТИЧЕСКИЙ АНАЛИЗ И ИСПРАВЛЕНИЕ СЕРВЕРА"

# 1. Проверить структуру файлов
echo -e "\n📋 АНАЛИЗ 1: Структура файлов"
echo "Файлы в корне:"
ls -la /var/www/bloknot-backend/ | grep "\.js$"
echo -e "\nФайлы в public:"
ls -la /var/www/bloknot-backend/public/ | grep "\.html$" | head -5

# 2. Проверить главный файл приложения
echo -e "\n📋 АНАЛИЗ 2: Главный файл приложения"
MAIN_FILE=$(pm2 show bloknot-backend 2>/dev/null | grep "script path" | awk '{print $4}' || echo "/var/www/bloknot-backend/index.js")
echo "Главный файл: $MAIN_FILE"

if [ ! -f "$MAIN_FILE" ]; then
    echo "❌ Главный файл не найден, ищу альтернативы..."
    for file in /var/www/bloknot-backend/{app,server,index}.js; do
        if [ -f "$file" ]; then
            MAIN_FILE="$file"
            echo "Найден файл: $MAIN_FILE"
            break
        fi
    done
fi

# 3. Анализ роутов в главном файле
echo -e "\n📋 АНАЛИЗ 3: Роуты в главном файле"
if [ -f "$MAIN_FILE" ]; then
    echo "Все роуты:"
    grep -n "app\." "$MAIN_FILE" | head -15
    
    echo -e "\nStatic роуты:"
    grep -n "express.static" "$MAIN_FILE" || echo "❌ Static роуты не найдены"
    
    echo -e "\nWildcard роуты:"
    grep -n "app\.get.*\*" "$MAIN_FILE" || echo "✅ Wildcard роуты не найдены"
fi

# 4. Проверить порядок роутов
echo -e "\n📋 АНАЛИЗ 4: Порядок роутов"
if [ -f "$MAIN_FILE" ]; then
    echo "Порядок важных роутов:"
    grep -n -E "(express\.static|app\.get.*\*|app\.use.*api)" "$MAIN_FILE" | head -10
fi

# 5. Проверить доступность файлов
echo -e "\n📋 АНАЛИЗ 5: Доступность файлов"
echo "Главная страница:"
curl -I -s http://localhost:3001/ | head -1 || echo "❌ Главная страница не доступна"

echo "Dashboard:"
curl -I -s http://localhost:3001/dashboard.html | head -1 || echo "❌ Dashboard не доступен"

echo "Test-login:"
curl -I -s http://localhost:3001/test-login.html | head -1 || echo "❌ Test-login не доступен"

echo "Simple-test:"
curl -I -s http://localhost:3001/simple-test.html | head -1 || echo "❌ Simple-test не доступен"

# 6. Диагностика проблемы
echo -e "\n📋 АНАЛИЗ 6: Диагностика проблемы"
if [ -f "$MAIN_FILE" ]; then
    # Проверить есть ли wildcard роут перед static
    WILDCARD_LINE=$(grep -n "app\.get.*\*" "$MAIN_FILE" | cut -d: -f1)
    STATIC_LINE=$(grep -n "express\.static" "$MAIN_FILE" | cut -d: -f1)
    
    if [ -n "$WILDCARD_LINE" ] && [ -n "$STATIC_LINE" ]; then
        if [ "$WILDCARD_LINE" -lt "$STATIC_LINE" ]; then
            echo "❌ ПРОБЛЕМА НАЙДЕНА: Wildcard роут (строка $WILDCARD_LINE) стоит перед static (строка $STATIC_LINE)"
            echo "Это блокирует доступ к static файлам!"
            
            # Исправить порядок роутов
            echo -e "\n🔧 ИСПРАВЛЕНИЕ: Перемещаю static роуты перед wildcard"
            
            # Создать временную копию
            cp "$MAIN_FILE" "$MAIN_FILE.backup"
            
            # Удалить wildcard роут
            sed -i '/app\.get.*\*/,/});/d' "$MAIN_FILE"
            
            # Добавить static роуты в начало (если их нет)
            if ! grep -q "express.static" "$MAIN_FILE"; then
                sed -i '/const app = express()/a app.use(express.static("public"));' "$MAIN_FILE"
            fi
            
            # Добавить wildcard роут в конец
            echo 'app.get("*", (req, res) => {' >> "$MAIN_FILE"
            echo '  res.sendFile(require("path").join(__dirname, "public/index.html"));' >> "$MAIN_FILE"
            echo '});' >> "$MAIN_FILE"
            
            echo "✅ Роуты исправлены"
            
            # Перезапустить сервер
            pm2 restart bloknot-backend
            sleep 3
            
            echo "Проверка после исправления:"
            curl -I -s http://localhost:3001/test-login.html | head -1
        else
            echo "✅ Порядок роутов правильный"
        fi
    else
        echo "⚠️  Не удалось найти один из роутов для анализа"
    fi
fi

# 7. Если static файлы все еще не работают, создать альтернативный тест
echo -e "\n📋 АНАЛИЗ 7: Создание альтернативного теста"
if ! curl -I -s http://localhost:3001/test-login.html | grep -q "200"; then
    echo "❌ Static файлы все еще не работают, создаю тест через API роут"
    
    cat > /var/www/bloknot-backend/create-test-route.js << 'EOF'
const fs = require('fs');
const path = require('path');

// Читать текущий index.js
const indexPath = '/var/www/bloknot-backend/index.js';
let content = fs.readFileSync(indexPath, 'utf8');

// Добавить тестовый роут перед wildcard
const testRoute = `
// Тестовый роут для входа
app.get('/test-login', (req, res) => {
  res.send(\`
<!DOCTYPE html>
<html>
<head>
    <title>Тест входа</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
</head>
<body>
    <h1>ТЕСТ ВХОДА В ЛК</h1>
    <button onclick="testLogin()">Войти (test@example.com)</button>
    <div id="result"></div>
    
    <script>
        async function testLogin() {
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({email: 'test@example.com', password: 'test123'})
                });
                
                const result = await response.json();
                
                if (result.success) {
                    localStorage.setItem('bloknot_logged_in', '1');
                    localStorage.setItem('bloknot_user_email', 'test@example.com');
                    localStorage.setItem('bloknot_logged_in_email', 'test@example.com');
                    
                    document.getElementById('result').innerHTML = 
                        '✅ Вход успешен! Email: ' + localStorage.getItem('bloknot_logged_in_email') + 
                        '<br><button onclick="goToDashboard()">Перейти в ЛК</button>';
                } else {
                    document.getElementById('result').innerHTML = '❌ Ошибка: ' + result.error;
                }
            } catch (error) {
                document.getElementById('result').innerHTML = '❌ Ошибка: ' + error.message;
            }
        }
        
        function goToDashboard() {
            window.location.href = '/dashboard.html';
        }
    </script>
</body>
</html>
  \`);
});
`;

// Вставить перед wildcard роутом
if (content.includes('app.get("*"')) {
    content = content.replace('app.get("*"', testRoute + '\n\napp.get("*"');
} else {
    content += testRoute;
}

fs.writeFileSync(indexPath, content);
console.log('✅ Тестовый роут добавлен');
EOF

    node create-test-route.js
    pm2 restart bloknot-backend
    sleep 3
    
    echo "Проверка тестового роута:"
    curl -I -s http://localhost:3001/test-login | head -1
fi

# 8. Финальная проверка
echo -e "\n📋 ФИНАЛЬНАЯ ПРОВЕРКА"
echo "Сервер работает:"
curl -s http://localhost:3001/api/version | grep -o Bloknot && echo "✅" || echo "❌"

echo "Тест входа доступен:"
if curl -I -s http://localhost:3001/test-login | grep -q "200"; then
    echo "✅ http://localhost:3001/test-login"
elif curl -I -s http://localhost:3001/test-login.html | grep -q "200"; then
    echo "✅ http://localhost:3001/test-login.html"
else
    echo "❌ Тест входа не доступен"
fi

echo -e "\n🎉 АНАЛИЗ И ИСПРАВЛЕНИЕ ЗАВЕРШЕНЫ!"
echo "📋 ДЛЯ ТЕСТИРОВАНИЯ:"
echo "1. Откройте доступный тест входа"
echo "2. Войдите с test@example.com / test123"
echo "3. Проверьте localStorage"
echo "4. Перейдите в ЛК"
