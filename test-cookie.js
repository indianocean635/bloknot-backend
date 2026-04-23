#!/usr/bin/env node

/**
 * Cookie Test Bot - Tests impersonate cookie functionality
 */

const https = require('https');
const http = require('http');

class CookieTestBot {
    constructor() {
        this.baseUrl = 'https://bloknotservis.ru';
    }

    async makeRequest(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const lib = url.protocol === 'https:' ? https : http;
            
            const req = lib.request(url, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: data,
                        cookies: this.parseCookies(res.headers['set-cookie'] || [])
                    });
                });
            });

            req.on('error', reject);
            if (options.body) {
                req.write(options.body);
            }
            req.end();
        });
    }

    parseCookies(setCookieHeader) {
        const cookies = [];
        if (Array.isArray(setCookieHeader)) {
            setCookieHeader.forEach(cookie => {
                const [nameValue] = cookie.split(';');
                const [name, value] = nameValue.split('=');
                cookies.push({ name: name.trim(), value: value?.trim() || '' });
            });
        }
        return cookies;
    }

    async testImpersonationCookie() {
        console.log('Testing impersonation cookie setting...');
        try {
            const testUserId = '573f991e-12a3-4c37-96a4-86d006fa3376';
            const response = await this.makeRequest(`/api/admin/impersonate/${testUserId}`, {
                redirect: 'manual'
            });
            
            if (response.status >= 300 && response.status < 400) {
                console.log('Impersonation redirect: SUCCESS');
                console.log(`Redirect to: ${response.headers.location}`);
                
                // Check if cookie was set
                const impersonateCookie = response.cookies.find(c => c.name === 'impersonate');
                if (impersonateCookie) {
                    console.log(`Cookie set: ${impersonateCookie.name}=${impersonateCookie.value}`);
                    return impersonateCookie.value;
                } else {
                    console.log('Cookie: NOT SET');
                    return null;
                }
            } else {
                console.log(`Impersonation failed: ${response.status}`);
                return null;
            }
        } catch (error) {
            console.log(`Impersonation error: ${error.message}`);
            return null;
        }
    }

    async testAPICallWithCookie(cookieValue) {
        console.log('Testing API call with cookie...');
        try {
            const cookieHeader = `impersonate=${cookieValue}`;
            const response = await this.makeRequest('/api/auth/me', {
                headers: {
                    'Cookie': cookieHeader
                }
            });
            
            console.log(`API call status: ${response.status}`);
            
            if (response.status === 200) {
                try {
                    const data = JSON.parse(response.data);
                    console.log(`API response: ${data.email || 'No email'}`);
                    console.log(`API user name: ${data.name || 'No name'}`);
                    return true;
                } catch (parseError) {
                    console.log('API response: NOT JSON');
                    console.log('Raw response:', response.data.substring(0, 200));
                    return false;
                }
            } else {
                console.log(`API failed: ${response.status}`);
                console.log('Error response:', response.data.substring(0, 200));
                return false;
            }
        } catch (error) {
            console.log(`API call error: ${error.message}`);
            return false;
        }
    }

    async testDashboardContent() {
        console.log('Testing dashboard content...');
        try {
            const response = await this.makeRequest('/dashboard.html?logged=1&v=20260420-1');
            
            if (response.status === 200) {
                console.log('Dashboard load: SUCCESS');
                
                // Check if new app.js is included
                if (response.data.includes('app.js?v=20260420-1&t=1713633600')) {
                    console.log('App.js version: CORRECT');
                } else {
                    console.log('App.js version: OLD VERSION CACHED');
                }
                
                // Check if logging is present
                if (response.data.includes('DASHBOARD HTML: Page started loading')) {
                    console.log('Dashboard logging: PRESENT');
                } else {
                    console.log('Dashboard logging: MISSING');
                }
                
                return true;
            } else {
                console.log(`Dashboard failed: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.log(`Dashboard error: ${error.message}`);
            return false;
        }
    }

    async runTest() {
        console.log('=== COOKIE TEST BOT STARTING ===');
        console.log(`Testing: ${this.baseUrl}`);
        console.log('Time:', new Date().toISOString());
        console.log('');
        
        // Test 1: Impersonation cookie setting
        const cookieValue = await this.testImpersonationCookie();
        console.log('');
        
        // Test 2: API call with cookie
        if (cookieValue) {
            await this.testAPICallWithCookie(cookieValue);
        } else {
            console.log('Skipping API test - no cookie set');
        }
        console.log('');
        
        // Test 3: Dashboard content
        await this.testDashboardContent();
        console.log('');
        
        console.log('=== COOKIE TEST BOT COMPLETE ===');
        console.log('\nMANUAL TEST INSTRUCTIONS:');
        console.log('1. Open browser incognito mode');
        console.log('2. Go to admin panel');
        console.log('3. Click on any email');
        console.log('4. Check browser console for logs');
        console.log('5. Check browser developer tools -> Application -> Cookies');
        console.log('6. Verify "impersonate" cookie is set');
        console.log('7. Check Network tab for /api/auth/me request');
        console.log('8. Verify request includes Cookie header with impersonate value');
    }
}

// Run the test
if (require.main === module) {
    const bot = new CookieTestBot();
    bot.runTest().catch(console.error);
}

module.exports = CookieTestBot;
