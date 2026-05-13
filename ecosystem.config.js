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
      script: 'services/telegramBot.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env_file: '.env',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/telegram-bot-err.log',
      out_file: './logs/telegram-bot-out.log',
      log_file: './logs/telegram-bot-combined.log',
      time: true
    }
  ]
};
