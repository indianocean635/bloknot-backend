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
    }
  ]
};
