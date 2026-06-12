const express = require('express');
const router = express.Router();
const { prisma } = require('../services/prismaService');
const VKLinkCodeService = require('../services/vkLinkCodeService');
const {
    createVKLinkCode,
    getVKLinkCode,
    linkVKByCode,
    sendVKMessage,
    getVKSubscribers,
    hasVKSubscriber,
    handleVKCallback
} = require('../controllers/vkCommunityController');

/**
 * Создание кода привязки для записи
 */
router.post('/link-code', async (req, res) => {
    try {
        const { businessId, appointmentId, customerName, customerPhone } = req.body;
        
        if (!businessId || !appointmentId || !customerName || !customerPhone) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        const linkCode = await createVKLinkCode(businessId, appointmentId, customerName, customerPhone);
        
        res.json({
            success: true,
            data: linkCode
        });
        
    } catch (error) {
        console.error('[VK COMMUNITY] Error creating link code:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Получение кода привязки по appointmentId
 */
router.get('/link-code/:appointmentId', async (req, res) => {
    try {
        const { appointmentId } = req.params;
        
        const linkCode = await getVKLinkCode(appointmentId);
        
        if (!linkCode) {
            return res.status(404).json({
                success: false,
                error: 'Link code not found or expired'
            });
        }
        
        res.json({
            success: true,
            data: linkCode
        });
        
    } catch (error) {
        console.error('[VK COMMUNITY] Error getting link code:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Привязка ВКонтакте по коду (для тестирования)
 */
router.post('/link', async (req, res) => {
    try {
        const { code, vkUserId } = req.body;
        
        if (!code || !vkUserId) {
            return res.status(400).json({
                success: false,
                error: 'Code and vkUserId are required'
            });
        }
        
        const result = await linkVKByCode(code, vkUserId);
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('[VK COMMUNITY] Error linking VK:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Отправка сообщения ВКонтакте
 */
router.post('/send-message', async (req, res) => {
    try {
        const { businessId, vkUserId, messageText, messageType } = req.body;
        
        if (!businessId || !vkUserId || !messageText || !messageType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        const messageId = await sendVKMessage(businessId, vkUserId, messageText, messageType);
        
        res.json({
            success: true,
            data: { messageId }
        });
        
    } catch (error) {
        console.error('[VK COMMUNITY] Error sending message:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Получение подписчиков бизнеса
 */
router.get('/subscribers/:businessId', async (req, res) => {
    try {
        const { businessId } = req.params;
        
        const subscribers = await getVKSubscribers(businessId);
        
        res.json({
            success: true,
            data: subscribers
        });
        
    } catch (error) {
        console.error('[VK COMMUNITY] Error getting subscribers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Проверка привязки VK по телефону
 */
router.post('/check-subscription', async (req, res) => {
    try {
        const { businessId, customerPhone } = req.body;
        
        if (!businessId || !customerPhone) {
            return res.status(400).json({
                success: false,
                error: 'Business ID and customer phone are required'
            });
        }
        
        const vkUserId = await hasVKSubscriber(businessId, customerPhone);
        
        res.json({
            success: true,
            data: {
                hasVK: !!vkUserId,
                vkUserId
            }
        });
        
    } catch (error) {
        console.error('[VK COMMUNITY] Error checking subscription:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Тестовый эндпоинт для проверки доступности
 */
router.get('/test', (req, res) => {
    console.log('[VK TEST] Endpoint accessed');
    res.status(200).json({
        success: true,
        message: 'VK Community API is working',
        timestamp: new Date().toISOString()
    });
});

/**
 * Callback API ВКонтакте (GET для тестирования)
 */
router.get('/callback', (req, res) => {
    console.log('[VK CALLBACK] GET request received');
    res.status(200).send('VK Callback API is ready');
});

/**
 * Callback API ВКонтакте (основной маршрут)
 */
router.post('/callback', async (req, res) => {
    try {
        const body = req.body;
        
        console.log('[VK CALLBACK] Received callback:', body.type);
        console.log('[VK CALLBACK] Group ID:', body.group_id);
        console.log('[VK CALLBACK] Full body:', JSON.stringify(body, null, 2));
        
        // Для события подтверждения возвращаем строку подтверждения
        if (body.type === 'confirmation') {
            try {
                const settings = await prisma.vKBusinessSettings.findFirst({
                    where: { groupId: body.group_id.toString() }
                });
                
                const confirmationString = settings?.confirmationCode || 'a25e9791';
                console.log('[VK CALLBACK] Returning confirmation string:', confirmationString);
                return res.status(200).send(confirmationString);
            } catch (error) {
                console.log('[VK CALLBACK] Error getting confirmation code, using fallback:', error);
                return res.status(200).send('a25e9791');
            }
        }
        
        // Для других событий используем businessId из group_id
        const businessId = '7a9e1231-beb0-4481-8df3-70e6a6928416'; // Ваш businessId
        
        console.log('[VK CALLBACK] Processing event type:', body.type);
        console.log('[VK CALLBACK] Full event data:', JSON.stringify(body, null, 2));
        
        // Для message_new сразу отправляем ответ для теста
        if (body.type === 'message_new') {
            const message = body.object?.message;
            const text = message?.text?.trim();
            const fromId = message?.from_id;
            
            console.log('[VK CALLBACK] Message_new received:', { text, fromId });
            
            if (text && text.startsWith('VK-')) {
                console.log('[VK CODE RECEIVED] Processing VK code:', text);
                
                try {
                    // Временно ищем запись по bookingToken
                    const bookingToken = text.replace('VK-', 'vk'); // VK-XXXXXX -> vkXXXXXX
                    const appointment = await prisma.appointment.findFirst({
                        where: {
                            bookingToken,
                            status: 'PENDING'
                        },
                        include: {
                            service: true,
                            master: true,
                            business: true
                        }
                    });

                    if (!appointment) {
                        console.log('[VK CODE NOT FOUND] Code not found or used:', text);
                        await sendVKMessage(
                            businessId,
                            fromId,
                            '❌ Код не найден или уже использован.',
                            'error'
                        );
                        return;
                    }

                    // Обновляем запись с VK User ID
                    await prisma.appointment.update({
                        where: { id: appointment.id },
                        data: {
                            vkUserId: fromId,
                            vkConnectedAt: new Date()
                        }
                    });

                    console.log('[VK USER LINKED] VK user linked to appointment:', {
                        vkUserId: fromId,
                        appointmentId: appointment.id,
                        customerName: appointment.customerName
                    });

                    // Отправляем подтверждение
                    await sendVKMessage(
                        businessId,
                        fromId,
                        `✅ ВКонтакте успешно подключён!\n\nНапоминания о записях будут приходить сюда.`,
                        'link_success'
                    );

                    if (appointment) {
                        const appointmentDate = new Date(appointment.startsAt);
                        await sendVKMessage(
                            businessId,
                            fromId,
                            `✅ Запись подтверждена\n\n` +
                            `📋 Услуга: ${appointment.service.name}\n` +
                            `👨‍💼 Специалист: ${appointment.master.name}\n` +
                            `📅 Дата: ${appointmentDate.toLocaleDateString('ru-RU')}\n` +
                            `⏰ Время: ${appointmentDate.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}\n` +
                            `💰 Стоимость: ${appointment.service.price} руб.`,
                            'appointment_info'
                        );
                    }

                    console.log('[VK NOTIFICATION SENT] Appointment details sent to user');

                } catch (error) {
                    console.error('[VK CODE ERROR] Error processing VK code:', error);
                    await sendVKMessage(
                        businessId,
                        fromId,
                        '❌ Произошла ошибка. Попробуйте позже.',
                        'error'
                    );
                }
            }
        }
        
        const result = await handleVKCallback(body, businessId);
        console.log('[VK CALLBACK] Handler result:', result);
        
        res.status(200).send('ok');
        
    } catch (error) {
        console.error('[VK CALLBACK] Error handling callback:', error);
        res.send('ok'); // Всегда отвечаем 'ok' чтобы VK не повторял запросы
    }
});

/**
 * Тестовая отправка сообщения
 */
router.post('/test-message', async (req, res) => {
    try {
        const { businessId, vkUserId } = req.body;
        
        if (!businessId || !vkUserId) {
            return res.status(400).json({
                success: false,
                error: 'Business ID and VK User ID are required'
            });
        }
        
        const testMessage = `🧪 Тестовое сообщение от системы записи\n\nВремя: ${new Date().toLocaleString('ru-RU')}`;
        
        const messageId = await sendVKMessage(businessId, vkUserId, testMessage, 'test');
        
        res.json({
            success: true,
            data: { 
                messageId,
                message: 'Тестовое сообщение отправлено'
            }
        });
        
    } catch (error) {
        console.error('[VK COMMUNITY] Error sending test message:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Получение настроек ВКонтакте бизнеса
 */
router.get('/settings/:businessId', async (req, res) => {
    try {
        const { businessId } = req.params;
        const connection = require('../config/database').pool;
        
        const [settings] = await connection.execute(
            'SELECT vkGroupId, isActive, createdAt FROM vk_business_settings WHERE businessId = ?',
            [businessId]
        );
        
        if (settings.length === 0) {
            return res.json({
                success: true,
                data: {
                    configured: false,
                    isActive: false
                }
            });
        }
        
        const setting = settings[0];
        const [subscribers] = await connection.execute(
            'SELECT COUNT(*) as count FROM vk_subscribers WHERE businessId = ?',
            [businessId]
        );
        
        res.json({
            success: true,
            data: {
                configured: true,
                isActive: setting.isActive,
                vkGroupId: setting.vkGroupId,
                subscribersCount: subscribers[0].count,
                createdAt: setting.createdAt
            }
        });
        
    } catch (error) {
        console.error('[VK COMMUNITY] Error getting settings:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
