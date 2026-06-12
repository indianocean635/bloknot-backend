-- Таблица для кодов привязки ВКонтакте
CREATE TABLE IF NOT EXISTS vk_link_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    businessId INT NOT NULL,
    appointmentId INT NOT NULL,
    customerName VARCHAR(255) NOT NULL,
    customerPhone VARCHAR(20) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    expiresAt DATETIME NOT NULL,
    vkUserId BIGINT DEFAULT NULL,
    isUsed BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_business_appointment (businessId, appointmentId),
    INDEX idx_expires (expiresAt),
    INDEX idx_vk_user (vkUserId)
);

-- Таблица для подписчиков ВКонтакте
CREATE TABLE IF NOT EXISTS vk_subscribers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    businessId INT NOT NULL,
    appointmentId INT NOT NULL,
    vkUserId BIGINT NOT NULL,
    customerName VARCHAR(255) NOT NULL,
    customerPhone VARCHAR(20) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_business_vk (businessId, vkUserId),
    INDEX idx_business (businessId),
    INDEX idx_vk_user (vkUserId),
    INDEX idx_appointment (appointmentId)
);

-- Таблица для настроек ВКонтакте бизнеса
CREATE TABLE IF NOT EXISTS vk_business_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    businessId INT NOT NULL UNIQUE,
    vkGroupId BIGINT NOT NULL,
    vkGroupToken VARCHAR(255) NOT NULL,
    vkCallbackUrl VARCHAR(500) NOT NULL,
    vkConfirmationCode VARCHAR(50) NOT NULL,
    vkSecretKey VARCHAR(255) DEFAULT NULL,
    isActive BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_business (businessId),
    INDEX idx_active (isActive)
);

-- Таблица для логов сообщений ВКонтакте
CREATE TABLE IF NOT EXISTS vk_message_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    businessId INT NOT NULL,
    vkUserId BIGINT NOT NULL,
    messageType ENUM('confirmation', 'reminder_24h', 'reminder_1h', 'cancellation', 'reschedule', 'link_success', 'test') NOT NULL,
    messageText TEXT NOT NULL,
    messageId VARCHAR(100) DEFAULT NULL,
    status ENUM('sent', 'delivered', 'read', 'error') DEFAULT 'sent',
    errorMessage TEXT DEFAULT NULL,
    sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_business (businessId),
    INDEX idx_vk_user (vkUserId),
    INDEX idx_message_type (messageType),
    INDEX idx_status (status),
    INDEX idx_sent_at (sentAt)
);
