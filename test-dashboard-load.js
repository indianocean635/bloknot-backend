#!/usr/bin/env node

/**
 * Dashboard Load Test - Tests if dashboard.html loads after impersonation
 */

const https = require('https');

async function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, 'https://bloknotservis.ru');
        const req = https.request(url, options, (res) => {
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
        req.end();
    });
}

async function testDashboardLoad() {
    console.log('=== DASHBOARD LOAD TEST ===');
    
    try {
        // Test dashboard.html with cache-busting
        console.log('Testing dashboard.html load...');
        const response = await makeRequest('/dashboard.html?logged=1&v=20260420-1');
        
        console.log(`Status: ${response.status}`);
        
        if (response.status === 200) {
            console.log('Dashboard load: SUCCESS');
            
            // Check for our logging
            if (response.data.includes('DASHBOARD HTML: Page started loading')) {
                console.log('Dashboard logging: FOUND');
            } else {
                console.log('Dashboard logging: NOT FOUND - old version cached');
            }
            
            // Check for app.js version
            if (response.data.includes('app.js?v=20260420-1&t=1713633600')) {
                console.log('App.js version: CORRECT');
            } else {
                console.log('App.js version: WRONG - old version cached');
            }
            
            // Check if page contains expected elements
            if (response.data.includes('id="userEmail"')) {
                console.log('Dashboard elements: FOUND');
            } else {
                console.log('Dashboard elements: NOT FOUND');
            }
            
            // Check for JavaScript errors
            if (response.data.includes('addEventListener')) {
                console.log('JavaScript code: PRESENT');
            } else {
                console.log('JavaScript code: MISSING');
            }
            
        } else {
            console.log(`Dashboard failed: ${response.status}`);
            console.log('Error:', response.data.substring(0, 200));
        }
        
        // Test if there's a redirect to index.html
        if (response.status === 302 || response.status === 301) {
            console.log(`Redirect detected to: ${response.headers.location}`);
        }
        
    } catch (error) {
        console.log(`Test error: ${error.message}`);
    }
    
    console.log('=== TEST COMPLETE ===');
}

testDashboardLoad();
