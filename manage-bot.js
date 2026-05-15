const { exec } = require('child_process');
const path = require('path');

console.log('🤖 Telegram Bot Manager');
console.log('========================');

// Function to check if bot is running
function checkBotRunning() {
  return new Promise((resolve) => {
    exec('tasklist | findstr node', (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      
      const nodeProcesses = stdout.split('\n').filter(line => line.includes('node.exe'));
      console.log(`Found ${nodeProcesses.length} Node.js processes running`);
      
      // Check if any of them are running the bot
      const botProcesses = nodeProcesses.filter(line => 
        line.includes('telegramBotService.js') || 
        line.includes('telegramBot.js') ||
        line.includes('index.js')
      );
      
      resolve(botProcesses.length > 0);
    });
  });
}

// Function to stop all bot instances
function stopAllBots() {
  return new Promise((resolve) => {
    console.log('🛑 Stopping all bot instances...');
    
    // Kill all node processes that might be running the bot
    exec('taskkill /F /IM node.exe', (error, stdout) => {
      if (error) {
        console.log('No Node.js processes to kill or error occurred');
      } else {
        console.log('✅ All Node.js processes stopped');
      }
      resolve();
    });
  });
}

// Function to start the new bot service
function startBotService() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting new bot service...');
    
    const botProcess = exec('node services/telegramBotService.js', {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    botProcess.on('error', (error) => {
      console.error('❌ Failed to start bot service:', error);
      reject(error);
    });
    
    botProcess.on('close', (code) => {
      console.log(`Bot service exited with code ${code}`);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Bot service exited with code ${code}`));
      }
    });
    
    // Give it a moment to start
    setTimeout(() => {
      console.log('✅ Bot service started successfully');
      resolve();
    }, 2000);
  });
}

// Function to check bot health
async function checkBotHealth() {
  try {
    const response = await fetch('http://localhost:8080/health');
    if (response.ok) {
      const health = await response.json();
      console.log('✅ Bot health check passed:', health);
      return true;
    }
  } catch (error) {
    console.log('❌ Bot health check failed:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'stop':
      await stopAllBots();
      break;
      
    case 'start':
      const botRunning = await checkBotRunning();
      if (botRunning) {
        console.log('⚠️  Bot instance is already running');
        console.log('Use "node manage-bot.js restart" to restart');
        process.exit(1);
      }
      await startBotService();
      break;
      
    case 'restart':
      console.log('🔄 Restarting bot service...');
      await stopAllBots();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for processes to fully stop
      await startBotService();
      
      // Check health after restart
      setTimeout(async () => {
        const isHealthy = await checkBotHealth();
        if (isHealthy) {
          console.log('🎉 Bot service is running and healthy!');
        } else {
          console.log('❌ Bot service may not be running correctly');
        }
      }, 3000);
      break;
      
    case 'status':
      const runningStatus = await checkBotRunning();
      const healthyStatus = await checkBotHealth();
      
      console.log('\n📊 Bot Status:');
      console.log(`Running: ${runningStatus ? '✅ Yes' : '❌ No'}`);
      console.log(`Healthy: ${healthyStatus ? '✅ Yes' : '❌ No'}`);
      
      if (!runningStatus || !healthyStatus) {
        console.log('\n💡 To fix issues, run: node manage-bot.js restart');
      }
      break;
      
    default:
      console.log('\n📖 Usage:');
      console.log('  node manage-bot.js start    - Start bot service');
      console.log('  node manage-bot.js stop     - Stop all bot instances');
      console.log('  node manage-bot.js restart  - Restart bot service');
      console.log('  node manage-bot.js status   - Check bot status');
      console.log('\n💡 To fix 409 conflicts, use: node manage-bot.js restart');
      break;
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch(console.error);
