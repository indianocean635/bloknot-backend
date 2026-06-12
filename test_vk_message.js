// Тестовая отправка VK сообщения
const { sendVKMessage } = require('./controllers/vkCommunityController');

async function testVKMessage() {
    try {
        console.log('🧪 Testing VK message to user 871315466...');
        
        const result = await sendVKMessage(
            'test-business', // businessId
            '871315466',     // vkUserId
            '✅ Тестовое сообщение\n\nЭто проверка отправки сообщений через VK Community API.',
            'test'
        );
        
        console.log('✅ VK message sent successfully:', result);
        
    } catch (error) {
        console.error('❌ VK message failed:', error.message);
    }
}

// Запуск теста
testVKMessage();
