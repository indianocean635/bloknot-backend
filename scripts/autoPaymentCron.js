#!/usr/bin/env node

const { processAutoPayments } = require('../services/autoPaymentService');

// Запуск автоматических платежей
async function runAutoPayments() {
  console.log('='.repeat(50));
  console.log('AUTO PAYMENT CRON JOB STARTED');
  console.log('Time:', new Date().toISOString());
  console.log('='.repeat(50));
  
  try {
    await processAutoPayments();
    
    console.log('='.repeat(50));
    console.log('AUTO PAYMENT CRON JOB COMPLETED SUCCESSFULLY');
    console.log('Time:', new Date().toISOString());
    console.log('='.repeat(50));
    
    process.exit(0);
  } catch (error) {
    console.error('AUTO PAYMENT CRON JOB FAILED:', error);
    process.exit(1);
  }
}

// Запуск
runAutoPayments();
