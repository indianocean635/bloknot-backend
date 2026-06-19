module.exports = {
  apps: [
    {
      name: 'bloknot',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_file: '.env',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
    {
      name: 'telegram-bot',
      script: 'services/telegramBotService.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_file: '.env',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/telegram-err.log',
      out_file: './logs/telegram-out.log',
      log_file: './logs/telegram-combined.log',
      time: true
    },
    {
      name: 'auto-payments',
      script: 'scripts/autoPaymentCron.js',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '200M',
      env_file: '.env',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/auto-payments-err.log',
      out_file: './logs/auto-payments-out.log',
      log_file: './logs/auto-payments-combined.log',
      time: true,
      cron_restart: '0 2 * * *' // Запуск каждый день в 2:00 ночи
    }
  ]
};
