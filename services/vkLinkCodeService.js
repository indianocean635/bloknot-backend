const { prisma } = require('./prismaService');

/**
 * Сервис для работы с VK кодами привязки
 */
class VKLinkCodeService {
    /**
     * Создание VK кода привязки
     */
    static async createLinkCode(businessId, appointmentId, customerName, customerPhone) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'VK-';
        
        // Генерируем уникальный код
        do {
            code = 'VK-';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        } while (await this.codeExists(code));
        
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
        
        const linkCode = await prisma.vKLinkCode.create({
            data: {
                code,
                businessId,
                appointmentId,
                customerName,
                customerPhone,
                expiresAt
            }
        });
        
        console.log('[VK CODE CREATED]', {
            code,
            appointmentId,
            customerName,
            expiresAt
        });
        
        return linkCode;
    }
    
    /**
     * Проверка существования кода
     */
    static async codeExists(code) {
        const existing = await prisma.vKLinkCode.findUnique({
            where: { code }
        });
        return !!existing;
    }
    
    /**
     * Поиск и использование кода
     */
    static async useCode(code, vkUserId) {
        console.log('[VK CODE LOOKUP] Looking for code:', code);
        
        const linkCode = await prisma.vKLinkCode.findFirst({
            where: {
                code,
                isUsed: false,
                expiresAt: {
                    gt: new Date()
                }
            },
            include: {
                appointment: {
                    include: {
                        service: true,
                        master: true,
                        business: true
                    }
                }
            }
        });
        
        if (!linkCode) {
            console.log('[VK CODE NOT FOUND] Code not found or expired:', code);
            return null;
        }
        
        // Помечаем код как использованный
        await prisma.vKLinkCode.update({
            where: { id: linkCode.id },
            data: {
                isUsed: true,
                vkUserId,
                usedAt: new Date()
            }
        });
        
        // Обновляем запись с VK User ID
        await prisma.appointment.update({
            where: { id: linkCode.appointmentId },
            data: {
                vkUserId,
                vkConnectedAt: new Date()
            }
        });
        
        console.log('[VK CODE USED]', {
            code,
            vkUserId,
            appointmentId: linkCode.appointmentId,
            customerName: linkCode.customerName
        });
        
        return linkCode;
    }
    
    /**
     * Получение неистекших кодов
     */
    static async getPendingCodes() {
        return await prisma.vKLinkCode.findMany({
            where: {
                isUsed: false,
                expiresAt: {
                    gt: new Date()
                }
            },
            include: {
                appointment: {
                    include: {
                        service: true,
                        master: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }
    
    /**
     * Очистка истекших кодов
     */
    static async cleanupExpiredCodes() {
        const result = await prisma.vKLinkCode.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date()
                }
            }
        });
        
        if (result.count > 0) {
            console.log(`[VK CODE CLEANUP] Deleted ${result.count} expired codes`);
        }
        
        return result.count;
    }
}

module.exports = VKLinkCodeService;
