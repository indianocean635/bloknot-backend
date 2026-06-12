const { prisma } = require('../services/prismaService');

/**
 * Генерация уникального кода привязки
 */
function generateLinkCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'VK-';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Создание кода привязки ВКонтакте
 */
async function createVKLinkCode(businessId, appointmentId, customerName, customerPhone) {
    try {
        // Генерируем уникальный код
        const code = generateLinkCode();
        
        // Временно возвращаем объект как будто это VKLinkCode
        return {
            id: appointmentId, // Временно используем appointmentId
            code,
            businessId,
            appointmentId,
            customerName,
            customerPhone,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 часа
        };
        
    } catch (error) {
        console.error('[VK CREATE CODE] Error:', error);
        throw error;
    }
}

/**
 * Получение кода привязки
 */
async function getVKLinkCode(code) {
    try {
        // Временно ищем запись по bookingToken
        const bookingToken = code.replace('VK-', 'vk'); // VK-XXXXXX -> vkXXXXXX
        const appointment = await prisma.appointment.findFirst({
            where: { bookingToken }
        });
        
        if (!appointment) {
            return null;
        }
        
        // Возвращаем объект как будто это VKLinkCode
        return {
            id: appointment.id,
            code,
            businessId: appointment.businessId,
            appointmentId: appointment.id,
            customerName: appointment.customerName,
            customerPhone: appointment.customerPhone || '',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
        
    } catch (error) {
        console.error('[VK GET CODE] Error:', error);
        throw error;
    }
}

/**
 * Привязка ВКонтакте по коду
 */
async function linkVKByCode(code, vkUserId) {
    try {
        console.log('[VK LINK CODE] Processing code:', code, 'for user:', vkUserId);
        
        // Временно ищем запись по bookingToken
        const bookingToken = code.replace('VK-', 'vk'); // VK-XXXXXX -> vkXXXXXX
        const appointment = await prisma.appointment.findFirst({
            where: {
                bookingToken,
                status: 'PENDING'
            }
        });
        
        if (!appointment) {
            console.log('[VK LINK CODE] Code not found or expired:', code);
            throw new Error('Invalid or expired code');
        }
        
        console.log('[VK LINK CODE] Found appointment:', appointment);
        
        // Обновляем запись с VK User ID
        await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
                customerVkId: vkUserId.toString(), // Сохраняем как строку
                vkConnectedAt: new Date()
            }
        });
        
        console.log('[VK LINK CODE] Successfully linked user to appointment');
        
        return {
            success: true,
            customerName: appointment.customerName,
            businessId: appointment.businessId
        };
        
    } catch (error) {
        console.error('[VK LINK CODE] Error:', error);
        throw error;
    }
}

/**
 * Отправка сообщения ВКонтакте
 */
async function sendVKMessage(businessId, vkUserId, messageText, messageType) {
    try {
        console.log('[VK SEND MESSAGE] Sending message to user:', vkUserId);
        
        // Получаем настройки бизнеса
        const settings = await prisma.vKBusinessSettings.findFirst({
            where: {
                businessId: businessId,
                isActive: true
            }
        });
        
        if (!settings) {
            throw new Error('VK settings not configured for business');
        }
        
        // Отправляем сообщение через VK API
        const axios = require('axios');
        const messageUrl = `https://api.vk.com/method/messages.send`;
        
        const params = {
            user_id: vkUserId,
            message: messageText,
            random_id: Math.floor(Math.random() * 1000000),
            access_token: settings.vkGroupToken,
            v: '5.199'
        };
        
        const response = await axios.post(messageUrl, null, { params });
        
        if (response.data.error) {
            throw new Error(`VK API Error: ${response.data.error.error_msg}`);
        }
        
        console.log('[VK SEND MESSAGE] Message sent successfully:', response.data.response);
        
        return response.data.response;
        
    } catch (error) {
        console.error('[VK SEND MESSAGE] Error:', error);
        throw error;
    }
}

/**
 * Получение подписчиков ВКонтакте
 */
async function getVKSubscribers(businessId) {
    try {
        const subscribers = await prisma.appointment.findMany({
            where: {
                businessId: businessId,
                vkUserId: {
                    not: null
                }
            },
            select: {
                id: true,
                customerName: true,
                customerPhone: true,
                vkUserId: true,
                vkConnectedAt: true
            }
        });
        
        return subscribers;
        
    } catch (error) {
        console.error('[VK GET SUBSCRIBERS] Error:', error);
        throw error;
    }
}

/**
 * Проверка наличия подписчика
 */
async function hasVKSubscriber(businessId, customerPhone) {
    try {
        const subscriber = await prisma.appointment.findFirst({
            where: {
                businessId: businessId,
                customerPhone: customerPhone,
                vkUserId: {
                    not: null
                }
            }
        });
        
        return subscriber ? subscriber.vkUserId : null;
        
    } catch (error) {
        console.error('[VK HAS SUBSCRIBER] Error:', error);
        throw error;
    }
}

/**
 * Обработка Callback API ВКонтакте
 */
async function handleVKCallback(body, businessId) {
    try {
        const { type, object } = body;
        
        switch (type) {
            case 'message_new':
                // Обработка нового сообщения
                const message = object.message;
                const text = message.text?.trim();
                const fromId = message.from_id;
                
                console.log('[VK CALLBACK] Message_new received:', { text, fromId });
                
                // Проверяем является ли текст кодом привязки
                if (text && text.startsWith('VK-')) {
                    console.log('[VK CALLBACK] Processing VK code:', text);
                    try {
                        const result = await linkVKByCode(text, fromId);
                        
                        // Отправляем подтверждение
                        await sendVKMessage(
                            businessId,
                            fromId,
                            `✅ ВКонтакте успешно подключён!\n\nТеперь вы будете получать уведомления о записи, ${result.customerName}.`,
                            'link_success'
                        );
                        
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
        
    } catch (error) {
        console.error('[VK CALLBACK] Error:', error);
        return 'ok';
    }
}

module.exports = {
    createVKLinkCode,
    getVKLinkCode,
    linkVKByCode,
    sendVKMessage,
    getVKSubscribers,
    hasVKSubscriber,
    handleVKCallback
};
