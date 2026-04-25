#!/bin/bash
# Применение debug функций напрямую через nano

echo "=== ПРИМЕНЕНИЕ DEBUG ФУНКЦИЙ ЧЕРЕZ NANO ==="

# 1. Создать полный файл с debug функциями
cat > /tmp/debug-functions.js << 'EOF'
  // Debug function to view logs that survive redirect
  window.showDebugLogs = function() {
    const logs = JSON.parse(localStorage.getItem('bloknot_debug_logs') || '[]');
    const redirectReason = JSON.parse(localStorage.getItem('bloknot_last_redirect_reason') || 'null');
    
    console.log('=== BLOKNOT DEBUG LOGS ===');
    console.log('Total API calls:', logs.length);
    
    logs.forEach((log, index) => {
      console.log(`\n--- API Call #${index + 1} ---`);
      console.log('Timestamp:', log.timestamp);
      console.log('Path:', log.path);
      console.log('localStorage:', log.localStorage);
      console.log('Cookies:', log.cookies);
      if (log.cookieCheck) {
        console.log('Cookie Check:', log.cookieCheck);
      }
      console.log('Final userEmail:', log.finalUserEmail);
      console.log('Will redirect:', log.willRedirect);
    });
    
    if (redirectReason) {
      console.log('\n=== LAST REDIRECT REASON ===');
      console.log('Timestamp:', redirectReason.timestamp);
      console.log('Reason:', redirectReason.reason);
      console.log('Path:', redirectReason.path);
      console.log('localStorage:', redirectReason.localStorage);
      console.log('Cookies:', redirectReason.cookies);
    }
    
    return { logs, redirectReason };
  };

  // Clear debug logs
  window.clearDebugLogs = function() {
    localStorage.removeItem('bloknot_debug_logs');
    localStorage.removeItem('bloknot_last_redirect_reason');
    console.log('Debug logs cleared');
  };

  // Auto-show logs if we have them (on page load)
  if (localStorage.getItem('bloknot_debug_logs')) {
    console.log('🔍 Debug logs found! Run showDebugLogs() to view them');
  }

EOF

# 2. Добавить функции после строки "function qs(sel) {"
sed -i '/function qs(sel) {/r /tmp/debug-functions.js' /var/www/bloknot-backend/public/app.js

# 3. Обновить cache-busting
sed -i 's/app.js?v=[0-9]*/app.js?v=20260425-debug2/' /var/www/bloknot-backend/public/dashboard.html

echo "✅ Debug функции добавлены"
echo "=== ПРОВЕРКА ==="
grep -n "window.showDebugLogs" /var/www/bloknot-backend/public/app.js

echo "=== ГОТОВО ДЛЯ ТЕСТИРОВАНИЯ ==="
