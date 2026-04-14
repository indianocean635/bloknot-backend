#!/usr/bin/env node

/**
 * Auto Test Robot for Bloknot Backend
 * Automatically tests and fixes common issues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AutoTestRobot {
  constructor() {
    this.errors = [];
    this.fixes = [];
    this.testResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? 'ERROR' : type === 'success' ? 'SUCCESS' : 'INFO';
    console.log(`[${timestamp}] ${prefix}: ${message}`);
  }

  // Test 1: Check server syntax
  async testServerSyntax() {
    this.log('Testing server syntax...');
    try {
      const result = execSync('node -c index.js', { encoding: 'utf8' });
      this.testResults.push({ test: 'syntax', status: 'passed' });
      this.log('Server syntax OK', 'success');
      return true;
    } catch (error) {
      this.errors.push('Server syntax error: ' + error.message);
      this.testResults.push({ test: 'syntax', status: 'failed', error: error.message });
      this.log('Server syntax FAILED', 'error');
      return false;
    }
  }

  // Test 2: Check critical files exist
  async testCriticalFiles() {
    this.log('Testing critical files...');
    const criticalFiles = [
      'index.js',
      'routes/authRoutes.js',
      'controllers/magicLinkController.js',
      'public/admin.html',
      'public/dashboard.html',
      'public/settings.html'
    ];

    let allExists = true;
    for (const file of criticalFiles) {
      if (!fs.existsSync(file)) {
        this.errors.push(`Critical file missing: ${file}`);
        allExists = false;
      }
    }

    if (allExists) {
      this.testResults.push({ test: 'files', status: 'passed' });
      this.log('All critical files exist', 'success');
    } else {
      this.testResults.push({ test: 'files', status: 'failed' });
      this.log('Critical files missing', 'error');
    }

    return allExists;
  }

  // Test 3: Check admin panel delete functionality
  async testAdminDeleteFunction() {
    this.log('Testing admin delete functionality...');
    try {
      const adminContent = fs.readFileSync('public/admin.html', 'utf8');
      
      // Check if protected emails are hardcoded
      const protectedEmails = ['apeskov635@gmail.com', 'admin@bloknotservis.ru'];
      let hasProtection = false;
      
      for (const email of protectedEmails) {
        if (adminContent.includes(email) && adminContent.includes('!==')) {
          hasProtection = true;
          break;
        }
      }

      if (hasProtection) {
        this.errors.push('Admin panel has hardcoded email protection');
        this.testResults.push({ test: 'admin-delete', status: 'failed' });
        this.log('Admin delete protection found', 'error');
        return false;
      } else {
        this.testResults.push({ test: 'admin-delete', status: 'passed' });
        this.log('Admin delete functionality OK', 'success');
        return true;
      }
    } catch (error) {
      this.errors.push('Error testing admin delete: ' + error.message);
      return false;
    }
  }

  // Test 4: Check password modal in dashboard
  async testPasswordModal() {
    this.log('Testing password modal...');
    try {
      const dashboardContent = fs.readFileSync('public/dashboard.html', 'utf8');
      
      const hasPasswordModal = dashboardContent.includes('passwordModal') && 
                              dashboardContent.includes('checkPasswordRequired') &&
                              dashboardContent.includes('showPasswordModal');

      if (!hasPasswordModal) {
        this.errors.push('Password modal missing in dashboard');
        this.testResults.push({ test: 'password-modal', status: 'failed' });
        this.log('Password modal missing', 'error');
        return false;
      } else {
        this.testResults.push({ test: 'password-modal', status: 'passed' });
        this.log('Password modal OK', 'success');
        return true;
      }
    } catch (error) {
      this.errors.push('Error testing password modal: ' + error.message);
      return false;
    }
  }

  // Test 5: Check settings authentication
  async testSettingsAuth() {
    this.log('Testing settings authentication...');
    try {
      const settingsContent = fs.readFileSync('public/settings.html', 'utf8');
      
      // Check for fallback email
      if (settingsContent.includes('peskov142@mail.ru') || 
          settingsContent.includes('fallback') ||
          settingsContent.includes("'peskov142@mail.ru'")) {
        this.errors.push('Settings has fallback email');
        this.testResults.push({ test: 'settings-auth', status: 'failed' });
        this.log('Settings fallback email found', 'error');
        return false;
      } else {
        this.testResults.push({ test: 'settings-auth', status: 'passed' });
        this.log('Settings authentication OK', 'success');
        return true;
      }
    } catch (error) {
      this.errors.push('Error testing settings auth: ' + error.message);
      return false;
    }
  }

  // Test 6: Check admin password column
  async testAdminPasswordColumn() {
    this.log('Testing admin password column...');
    try {
      const adminContent = fs.readFileSync('public/admin.html', 'utf8');
      
      const hasPasswordColumn = adminContent.includes('password') && 
                               adminContent.includes('Password') &&
                               (adminContent.includes('user.password') || adminContent.includes('password'));

      if (!hasPasswordColumn) {
        this.errors.push('Admin panel missing password column');
        this.testResults.push({ test: 'admin-password', status: 'failed' });
        this.log('Admin password column missing', 'error');
        return false;
      } else {
        this.testResults.push({ test: 'admin-password', status: 'passed' });
        this.log('Admin password column OK', 'success');
        return true;
      }
    } catch (error) {
      this.errors.push('Error testing admin password column: ' + error.message);
      return false;
    }
  }

  // Auto-fix common issues
  async autoFixIssues() {
    this.log('Attempting auto-fixes...');
    
    // Fix 1: Remove fallback email from settings
    try {
      const settingsContent = fs.readFileSync('public/settings.html', 'utf8');
      if (settingsContent.includes('peskov142@mail.ru')) {
        const fixedContent = settingsContent.replace(/||\s*'peskov142@mail.ru'.*\/\/.*Fallback.*/g, '');
        fs.writeFileSync('public/settings.html', fixedContent);
        this.fixes.push('Removed fallback email from settings.html');
        this.log('Fixed: Removed fallback email', 'success');
      }
    } catch (error) {
      this.log('Failed to fix fallback email: ' + error.message, 'error');
    }

    // Fix 2: Check authRoutes.js syntax
    try {
      const authContent = fs.readFileSync('routes/authRoutes.js', 'utf8');
      const openBraces = (authContent.match(/{/g) || []).length;
      const closeBraces = (authContent.match(/}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        this.log('Brace mismatch detected in authRoutes.js', 'error');
        // Add missing closing brace if needed
        if (openBraces > closeBraces) {
          const missingBraces = openBraces - closeBraces;
          const fixedContent = authContent + '\n' + '});'.repeat(missingBraces);
          fs.writeFileSync('routes/authRoutes.js', fixedContent);
          this.fixes.push(`Added ${missingBraces} missing closing braces to authRoutes.js`);
          this.log('Fixed: Added missing closing braces', 'success');
        }
      }
    } catch (error) {
      this.log('Failed to fix authRoutes.js: ' + error.message, 'error');
    }
  }

  // Run all tests
  async runAllTests() {
    this.log('=== AUTO TEST ROBOT STARTING ===');
    
    const tests = [
      this.testServerSyntax(),
      this.testCriticalFiles(),
      this.testAdminDeleteFunction(),
      this.testPasswordModal(),
      this.testSettingsAuth(),
      this.testAdminPasswordColumn()
    ];

    const results = await Promise.allSettled(tests);
    const passedTests = results.filter(r => r.value).length;
    const totalTests = tests.length;

    this.log(`Tests passed: ${passedTests}/${totalTests}`);

    if (this.errors.length > 0) {
      this.log('Errors found:', 'error');
      this.errors.forEach(error => this.log('  - ' + error, 'error'));
      
      this.log('Attempting auto-fixes...');
      await this.autoFixIssues();
      
      if (this.fixes.length > 0) {
        this.log('Auto-fixes applied:', 'success');
        this.fixes.forEach(fix => this.log('  - ' + fix, 'success'));
      }
    }

    this.log('=== AUTO TEST ROBOT FINISHED ===');
    
    return {
      success: passedTests === totalTests,
      passedTests,
      totalTests,
      errors: this.errors,
      fixes: this.fixes,
      testResults: this.testResults
    };
  }
}

// Run if called directly
if (require.main === module) {
  const robot = new AutoTestRobot();
  robot.runAllTests().then(result => {
    console.log('\n=== FINAL RESULTS ===');
    console.log(`Success: ${result.success ? 'YES' : 'NO'}`);
    console.log(`Tests: ${result.passedTests}/${result.totalTests} passed`);
    if (result.errors.length > 0) {
      console.log('Errors:', result.errors.length);
    }
    if (result.fixes.length > 0) {
      console.log('Fixes applied:', result.fixes.length);
    }
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Robot failed:', error);
    process.exit(1);
  });
}

module.exports = AutoTestRobot;
