// Тестовая отправка VK сообщения через fetch (без axios)
const https = require('https');
const querystring = require('querystring');

async function sendVKMessageDirect(vkUserId, messageText) {
    try {
        console.log('🧪 Testing VK message via fetch (no axios)...');
        
        const accessToken = process.env.VK_ACCESS_TOKEN;
        
        if (!accessToken) {
            throw new Error('VK_ACCESS_TOKEN not configured');
        }
        
        // Формируем URL с параметрами
        const baseUrl = 'https://api.vk.com/method/messages.send';
        const params = {
            user_id: vkUserId,
            message: messageText,
            random_id: Math.floor(Math.random() * 1000000),
            access_token: accessToken,
            v: '5.199'
        };
        
        const url = `${baseUrl}?${querystring.stringify(params)}`;
        
        console.log('VK URL (direct):', url);
        console.log('VK PARAMS (direct):', params);
        
        // Отправляем через https модуль (минимум зависимостей)
        return new Promise((resolve, reject) => {
            const req = https.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    console.log('VK RESPONSE STATUS (direct):', res.statusCode);
                    console.log('VK RESPONSE HEADERS (direct):', res.headers);
                    console.log('VK RESPONSE DATA (direct):', data);
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            reject(new Error(`VK API Error: ${parsed.error.error_msg}`));
                        } else {
                            resolve(parsed.response);
                        }
                    } catch (e) {
                        reject(new Error(`Invalid JSON response: ${data}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                console.error('VK REQUEST ERROR (direct):', error);
                reject(error);
            });
            
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
        
    } catch (error) {
        console.error('❌ VK message failed (direct):', error.message);
        throw error;
    }
}

// Запуск теста
async function testDirect() {
    try {
        const result = await sendVKMessageDirect(
            '871315466',
            '✅ Тестовое сообщение через fetch\n\nЭто проверка отправки без axios.'
        );
        console.log('✅ VK message sent successfully (direct):', result);
    } catch (error) {
        console.error('❌ VK message failed (direct):', error);
    }
}

testDirect();
