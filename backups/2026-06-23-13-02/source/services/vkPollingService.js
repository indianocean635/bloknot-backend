const { prisma } = require('./prismaService');
const { sendVKMessage } = require('../controllers/vkCommunityController');

/**
 * Сервис для проверки VK кодов по опросу (альтернатива Callback API)
 */
class VKPollingService {
    constructor() {
        this.isRunning = false;
        this.pollInterval = null;
        this.POLL_INTERVAL_MS = 30000; // 30 секунд
    }

    /**
     * Запуск опроса VK кодов
     */
    start() {
        if (this.isRunning) {
            console.log('[VK POLLING] Already running');
            return;
        }

        console.log('[VK POLLING] Starting VK code polling service');
        this.isRunning = true;
        
        // Запускаем немедленно
        this.checkPendingCodes();
        
        // Устанавливаем периодическую проверку
        this.pollInterval = setInterval(() => {
            this.checkPendingCodes();
        }, this.POLL_INTERVAL_MS);
    }

    /**
     * Остановка опроса
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        console.log('[VK POLLING] Stopping VK code polling service');
        this.isRunning = false;
        
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    /**
     * Проверка необработанных VK кодов
     */
    async checkPendingCodes() {
        try {
            console.log('[VK POLLING] Checking pending VK codes...');
            
            // Ищем необработанные коды привязки
            const pendingCodes = await prisma.vKLinkCode.findMany({
                where: {
                    isUsed: false,
                    expiresAt: {
                        gt: new Date()
                    }
                },
                include: {
                    appointment: {
                        include: {
                            business: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 10 // Ограничиваем количество для производительности
            });

            console.log(`[VK POLLING] Found ${pendingCodes.length} pending codes`);

            for (const codeData of pendingCodes) {
                await this.processCode(codeData);
            }
            
        } catch (error) {
            console.error('[VK POLLING] Error checking pending codes:', error);
        }
    }

    /**
     * Обработка одного кода
     */
    async processCode(codeData) {
        try {
            console.log(`[VK POLLING] Processing code: ${codeData.code}`);
            
            // Проверяем есть ли уже подписчик для этого кода
            const existingSubscriber = await prisma.vKSubscriber.findFirst({
                where: {
                    appointmentId: codeData.appointmentId
                }
            });

            if (existingSubscriber) {
                console.log(`[VK POLLING] Code ${codeData.code} already has subscriber, marking as used`);
                await prisma.vKLinkCode.update({
                    where: { id: codeData.id },
                    data: { isUsed: true }
                });
                return;
            }

            // Здесь можно добавить логику проверки был ли код отправлен в VK
            // Для простоты пока просто логируем
            console.log(`[VK POLLING] Code ${codeData.code} is waiting for VK user`);
            
            // Можно добавить проверку по времени - если код создан более 5 минут назад
            // и не использован, можно отправить уведомление администратору
            const codeAge = Date.now() - new Date(codeData.createdAt).getTime();
            if (codeAge > 5 * 60 * 1000) { // 5 минут
                console.log(`[VK POLLING] Code ${codeData.code} is old (${Math.round(codeAge/60000)} minutes)`);
            }
            
        } catch (error) {
            console.error(`[VK POLLING] Error processing code ${codeData.code}:`, error);
        }
    }

    /**
     * Ручная проверка конкретного кода
     */
    async checkSpecificCode(code) {
        try {
            console.log(`[VK POLLING] Manual check for code: ${code}`);
            
            const codeData = await prisma.vKLinkCode.findFirst({
                where: {
                    code: code,
                    isUsed: false,
                    expiresAt: {
                        gt: new Date()
                    }
                },
                include: {
                    appointment: {
                        include: {
                            business: true
                        }
                    }
                }
            });

            if (!codeData) {
                console.log(`[VK POLLING] Code ${code} not found or expired`);
                return null;
            }

            await this.processCode(codeData);
            return codeData;
            
        } catch (error) {
            console.error(`[VK POLLING] Error checking code ${code}:`, error);
            return null;
        }
    }
}

// Создаем singleton
const vkPollingService = new VKPollingService();

module.exports = vkPollingService;
