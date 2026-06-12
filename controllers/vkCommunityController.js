const { pool } = require('../config/database');

/**
 * Генерация уникального кода привязки
 */
function generateLinkCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'BK-';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Создание кода привязки ВКонтакте
 */
async function createVKLinkCode(businessId, appointmentId, customerName, customerPhone) {
    const connection = await pool.getConnection();
    
    try {
        // Проверяем существующий код
        const [existing] = await connection.execute(
            'SELECT id FROM vk_link_codes WHERE appointmentId = ? AND isUsed = FALSE AND expiresAt > NOW()',
            [appointmentId]
        );
        
        if (existing.length > 0) {
            // Получаем существующий код
            const [codeRow] = await connection.execute(
                'SELECT code, expiresAt FROM vk_link_codes WHERE appointmentId = ? AND isUsed = FALSE',
                [appointmentId]
            );
            return codeRow[0];
        }
        
        // Генерируем новый код
        let code;
        let attempts = 0;
        const maxAttempts = 10;
        
        do {
            code = generateLinkCode();
            const [check] = await connection.execute(
                'SELECT id FROM vk_link_codes WHERE code = ?',
                [code]
            );
            if (check.length === 0) break;
            attempts++;
        } while (attempts < maxAttempts);
        
        if (attempts >= maxAttempts) {
            throw new Error('Failed to generate unique code');
        }
        
        // Срок действия - 24 часа
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        // Сохраняем код
        const [result] = await connection.execute(
            `INSERT INTO vk_link_codes 
             (businessId, appointmentId, customerName, customerPhone, code, expiresAt) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [businessId, appointmentId, customerName, customerPhone, code, expiresAt]
        );
        
        return {
            id: result.insertId,
            code,
            expiresAt
        };
        
    } finally {
        connection.release();
    }
}

/**
 * Получение кода привязки по appointmentId
 */
async function getVKLinkCode(appointmentId) {
    const connection = await pool.getConnection();
    
    try {
        const [rows] = await connection.execute(
            'SELECT * FROM vk_link_codes WHERE appointmentId = ? AND isUsed = FALSE AND expiresAt > NOW()',
            [appointmentId]
        );
        
        return rows.length > 0 ? rows[0] : null;
        
    } finally {
        connection.release();
    }
}

/**
 * Привязка ВКонтакте по коду
 */
async function linkVKByCode(code, vkUserId) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Ищем код
        const [codeRows] = await connection.execute(
            'SELECT * FROM vk_link_codes WHERE code = ? AND isUsed = FALSE AND expiresAt > NOW()',
            [code]
        );
        
        if (codeRows.length === 0) {
            throw new Error('Invalid or expired code');
        }
        
        const linkCode = codeRows[0];
        
        // Проверяем, не привязан ли уже этот VK
        const [existingSub] = await connection.execute(
            'SELECT id FROM vk_subscribers WHERE businessId = ? AND vkUserId = ?',
            [linkCode.businessId, vkUserId]
        );
        
        if (existingSub.length === 0) {
            // Создаем новую подписку
            await connection.execute(
                `INSERT INTO vk_subscribers 
                 (businessId, appointmentId, vkUserId, customerName, customerPhone) 
                 VALUES (?, ?, ?, ?, ?)`,
                [linkCode.businessId, linkCode.appointmentId, vkUserId, linkCode.customerName, linkCode.customerPhone]
            );
        }
        
        // Помечаем код как использованный
        await connection.execute(
            'UPDATE vk_link_codes SET isUsed = TRUE, vkUserId = ? WHERE id = ?',
            [vkUserId, linkCode.id]
        );
        
        await connection.commit();
        
        return {
            success: true,
            customerName: linkCode.customerName,
            businessId: linkCode.businessId
        };
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Отправка сообщения ВКонтакте
 */
async function sendVKMessage(businessId, vkUserId, messageText, messageType) {
    const connection = await pool.getConnection();
    
    try {
        // Получаем настройки бизнеса
        const [settings] = await connection.execute(
            'SELECT * FROM vk_business_settings WHERE businessId = ? AND isActive = TRUE',
            [businessId]
        );
        
        if (settings.length === 0) {
            throw new Error('VK settings not configured for business');
        }
        
        const setting = settings[0];
        
        // Отправляем сообщение через VK API
        const axios = require('axios');
        const messageUrl = `https://api.vk.com/method/messages.send`;
        
        const params = {
            user_id: vkUserId,
            message: messageText,
            random_id: Math.floor(Math.random() * 1000000),
            access_token: setting.vkGroupToken,
            v: '5.199'
        };
        
        const response = await axios.post(messageUrl, null, { params });
        
        if (response.data.error) {
            throw new Error(`VK API Error: ${response.data.error.error_msg}`);
        }
        
        // Логируем отправку
        await connection.execute(
            `INSERT INTO vk_message_logs 
             (businessId, vkUserId, messageType, messageText, messageId, status) 
             VALUES (?, ?, ?, ?, ?, 'sent')`,
            [businessId, vkUserId, messageType, messageText, response.data.response]
        );
        
        return response.data.response;
        
    } catch (error) {
        // Логируем ошибку
        if (connection) {
            await connection.execute(
                `INSERT INTO vk_message_logs 
                 (businessId, vkUserId, messageType, messageText, status, errorMessage) 
                 VALUES (?, ?, ?, ?, 'error', ?)`,
                [businessId, vkUserId, messageType, messageText, error.message]
            );
        }
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Получение подписчиков бизнеса
 */
async function getVKSubscribers(businessId) {
    const connection = await pool.getConnection();
    
    try {
        const [rows] = await connection.execute(
            'SELECT * FROM vk_subscribers WHERE businessId = ? ORDER BY createdAt DESC',
            [businessId]
        );
        
        return rows;
        
    } finally {
        connection.release();
    }
}

/**
 * Проверка есть ли у клиента привязка VK
 */
async function hasVKSubscriber(businessId, customerPhone) {
    const connection = await pool.getConnection();
    
    try {
        const [rows] = await connection.execute(
            'SELECT vkUserId FROM vk_subscribers WHERE businessId = ? AND customerPhone = ?',
            [businessId, customerPhone]
        );
        
        return rows.length > 0 ? rows[0].vkUserId : null;
        
    } finally {
        connection.release();
    }
}

/**
 * Обработка Callback API ВКонтакте
 */
async function handleVKCallback(body, businessId) {
    const connection = await pool.getConnection();
    
    try {
        const { type, object } = body;
        
        switch (type) {
            case 'confirmation':
                // Возвращаем код подтверждения
                const [settings] = await connection.execute(
                    'SELECT vkConfirmationCode FROM vk_business_settings WHERE businessId = ?',
                    [businessId]
                );
                return settings.length > 0 ? settings[0].vkConfirmationCode : null;
                
            case 'message_new':
                // Обработка нового сообщения
                const message = object.message;
                const text = message.text?.trim();
                const fromId = message.from_id;
                
                // Проверяем является ли текст кодом привязки
                if (text && text.startsWith('BK-')) {
                    try {
                        const result = await linkVKByCode(text, fromId);
                        
                        // Отправляем подтверждение
                        await sendVKMessage(
                            businessId,
                            fromId,
                            `✅ ВКонтакте успешно подключён!\n\nТеперь вы будете получать уведомления о записи, ${result.customerName}.`,
                            'link_success'
                        );
                        
                        return 'ok';
                    } catch (error) {
                        // Отправляем сообщение об ошибке
                        await sendVKMessage(
                            businessId,
                            fromId,
                            '❌ Неверный или просроченный код. Попробуйте снова или обратитесь к администратору.',
                            'error'
                        );
                    }
                }
                return 'ok';
                
            default:
                return 'ok';
        }
        
    } finally {
        connection.release();
    }
}

module.exports = {
    createVKLinkCode,
    getVKLinkCode,
    linkVKByCode,
    sendVKMessage,
    getVKSubscribers,
    hasVKSubscriber,
    handleVKCallback,
    generateLinkCode
};
