#!/usr/bin/env node

/**
 * Automated Impersonation Test Bot
 * Tests admin impersonation functionality and identifies issues
 */

const https = require('https');
const http = require('http');

class ImpersonationTestBot {
    constructor() {
        this.baseUrl = 'https://bloknotservis.ru';
        this.results = {
            adminAuth: false,
            impersonation: false,
            dashboardLoad: false,
            apiCalls: false,
            errors: []
        };
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
                        data: data
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

    async testAdminAuth() {
        console.log('Testing admin authentication...');
        try {
            const response = await this.makeRequest('/api/admin/stats');
            if (response.status === 200) {
                this.results.adminAuth = true;
                console.log('Admin auth: SUCCESS');
            } else {
                this.results.errors.push(`Admin auth failed: ${response.status}`);
                console.log(`Admin auth: FAILED (${response.status})`);
            }
        } catch (error) {
            this.results.errors.push(`Admin auth error: ${error.message}`);
            console.log(`Admin auth: ERROR - ${error.message}`);
        }
    }

    async testImpersonation() {
        console.log('Testing impersonation...');
        try {
            // Test impersonation endpoint with a sample user ID
            const testUserId = '9efe2532-df90-4527-8715-df1451c0db0c';
            const response = await this.makeRequest(`/api/admin/impersonate/${testUserId}`, {
                redirect: 'manual' // Don't follow redirects
            });
            
            if (response.status >= 300 && response.status < 400) {
                this.results.impersonation = true;
                console.log('Impersonation: SUCCESS');
                console.log(`Redirect to: ${response.headers.location}`);
            } else {
                this.results.errors.push(`Impersonation failed: ${response.status}`);
                console.log(`Impersonation: FAILED (${response.status})`);
            }
        } catch (error) {
            this.results.errors.push(`Impersonation error: ${error.message}`);
            console.log(`Impersonation: ERROR - ${error.message}`);
        }
    }

    async testDashboardLoad() {
        console.log('Testing dashboard load...');
        try {
            const response = await this.makeRequest('/dashboard.html?logged=1&v=20260420-1');
            
            if (response.status === 200) {
                this.results.dashboardLoad = true;
                console.log('Dashboard load: SUCCESS');
                
                // Check if dashboard contains expected elements
                if (response.data.includes('DASHBOARD HTML: Page started loading')) {
                    console.log('Dashboard logging: FOUND');
                } else {
                    this.results.errors.push('Dashboard logging not found - old version cached');
                    console.log('Dashboard logging: NOT FOUND - old version cached');
                }
                
                if (response.data.includes('app.js?v=20260420-1&t=1713633600')) {
                    console.log('App.js version: CORRECT');
                } else {
                    this.results.errors.push('Wrong app.js version in dashboard');
                    console.log('App.js version: WRONG');
                }
            } else {
                this.results.errors.push(`Dashboard load failed: ${response.status}`);
                console.log(`Dashboard load: FAILED (${response.status})`);
            }
        } catch (error) {
            this.results.errors.push(`Dashboard load error: ${error.message}`);
            console.log(`Dashboard load: ERROR - ${error.message}`);
        }
    }

    async testAPICalls() {
        console.log('Testing API calls...');
        try {
            const response = await this.makeRequest('/api/auth/me');
            
            if (response.status === 200) {
                this.results.apiCalls = true;
                console.log('API calls: SUCCESS');
                
                try {
                    const data = JSON.parse(response.data);
                    if (data.email) {
                        console.log(`API user data: ${data.email}`);
                    } else {
                        this.results.errors.push('API returned no user data');
                        console.log('API user data: EMPTY');
                    }
                } catch (parseError) {
                    this.results.errors.push('API response not valid JSON');
                    console.log('API response: NOT JSON');
                }
            } else {
                this.results.errors.push(`API calls failed: ${response.status}`);
                console.log(`API calls: FAILED (${response.status})`);
            }
        } catch (error) {
            this.results.errors.push(`API calls error: ${error.message}`);
            console.log(`API calls: ERROR - ${error.message}`);
        }
    }

    async diagnoseProblem() {
        console.log('\n=== DIAGNOSING PROBLEM ===');
        
        if (!this.results.adminAuth) {
            console.log('PROBLEM: Admin authentication not working');
            console.log('SOLUTION: Check admin middleware and headers');
        }
        
        if (!this.results.impersonation) {
            console.log('PROBLEM: Impersonation endpoint not working');
            console.log('SOLUTION: Check admin routes and user lookup');
        }
        
        if (!this.results.dashboardLoad) {
            console.log('PROBLEM: Dashboard not loading');
            console.log('SOLUTION: Check static file serving and cache-busting');
        }
        
        if (!this.results.apiCalls) {
            console.log('PROBLEM: API calls not working');
            console.log('SOLUTION: Check authentication middleware and cookie handling');
        }
        
        if (this.results.adminAuth && this.results.impersonation && !this.results.dashboardLoad) {
            console.log('PROBLEM: Backend works but frontend not loading');
            console.log('SOLUTION: Check browser cache, CDN, or static file serving');
        }
        
        if (this.results.adminAuth && this.results.impersonation && this.results.dashboardLoad && !this.results.apiCalls) {
            console.log('PROBLEM: Dashboard loads but API calls fail');
            console.log('SOLUTION: Check cookie transmission and middleware');
        }
    }

    async generateSolution() {
        console.log('\n=== GENERATED SOLUTION ===');
        
        if (this.results.errors.length === 0) {
            console.log('EVERYTHING WORKS! Problem may be browser-specific.');
            return;
        }
        
        console.log('Errors found:');
        this.results.errors.forEach(error => console.log(`- ${error}`));
        
        console.log('\nRecommended fixes:');
        
        if (!this.results.dashboardLoad) {
            console.log('1. Clear browser cache or use incognito mode');
            console.log('2. Check if dashboard.html exists on server');
            console.log('3. Verify static file serving in Express');
        }
        
        if (!this.results.apiCalls) {
            console.log('1. Check impersonate cookie is being set');
            console.log('2. Verify /api/auth/me reads impersonate cookie');
            console.log('3. Check middleware authentication');
        }
        
        console.log('\nTest commands to run:');
        console.log('1. curl -I https://bloknotservis.ru/dashboard.html?logged=1&v=20260420-1');
        console.log('2. curl -b "impersonate=test@example.com" https://bloknotservis.ru/api/auth/me');
        console.log('3. pm2 logs --lines 50');
    }

    async runFullTest() {
        console.log('=== IMPERSONATION TEST BOT STARTING ===');
        console.log(`Testing: ${this.baseUrl}`);
        console.log('Time:', new Date().toISOString());
        console.log('');
        
        await this.testAdminAuth();
        await this.testImpersonation();
        await this.testDashboardLoad();
        await this.testAPICalls();
        
        console.log('\n=== TEST RESULTS ===');
        console.log(`Admin Auth: ${this.results.adminAuth ? 'PASS' : 'FAIL'}`);
        console.log(`Impersonation: ${this.results.impersonation ? 'PASS' : 'FAIL'}`);
        console.log(`Dashboard Load: ${this.results.dashboardLoad ? 'PASS' : 'FAIL'}`);
        console.log(`API Calls: ${this.results.apiCalls ? 'PASS' : 'FAIL'}`);
        
        await this.diagnoseProblem();
        await this.generateSolution();
        
        console.log('\n=== TEST BOT COMPLETE ===');
        return this.results;
    }
}

// Run the test
if (require.main === module) {
    const bot = new ImpersonationTestBot();
    bot.runFullTest().catch(console.error);
}

module.exports = ImpersonationTestBot;
