#!/usr/bin/env node

/**
 * Browser State Test - Tests what happens when browser makes requests
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
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

async function testBrowserState() {
    console.log('=== BROWSER STATE TEST ===');
    
    try {
        // Test 1: Check what happens with no headers (like fresh browser)
        console.log('1. Testing with no authentication headers...');
        const response1 = await makeRequest('/api/auth/me');
        console.log(`Status: ${response1.status}`);
        if (response1.status === 200) {
            try {
                const data = JSON.parse(response1.data);
                const user = data.user || data;
                console.log(`No headers - User returned: ${user.email}`);
                console.log('PROBLEM: Should require authentication!');
            } catch (e) {
                console.log('Response not valid JSON');
            }
        } else {
            console.log('GOOD: Requires authentication');
        }
        
        // Test 2: Check with peskov142@mail.ru header (like normal login)
        console.log('\n2. Testing with peskov142@mail.ru header...');
        const response2 = await makeRequest('/api/auth/me', {
            headers: {
                'x-user-email': 'peskov142@mail.ru'
            }
        });
        console.log(`Status: ${response2.status}`);
        if (response2.status === 200) {
            try {
                const data = JSON.parse(response2.data);
                const user = data.user || data;
                console.log(`peskov142 header - User returned: ${user.email}`);
            } catch (e) {
                console.log('Response not valid JSON');
            }
        }
        
        // Test 3: Check with impersonate cookie (like after impersonation)
        console.log('\n3. Testing with impersonate cookie...');
        const response3 = await makeRequest('/api/auth/me', {
            headers: {
                'Cookie': 'impersonate=indianocean635%40gmail.com'
            }
        });
        console.log(`Status: ${response3.status}`);
        if (response3.status === 200) {
            try {
                const data = JSON.parse(response3.data);
                const user = data.user || data;
                console.log(`impersonate cookie - User returned: ${user.email}`);
                if (user.email === 'indianocean635@gmail.com') {
                    console.log('PROBLEM: Impersonate cookie overrides normal login!');
                }
            } catch (e) {
                console.log('Response not valid JSON');
            }
        }
        
        // Test 4: Check priority - what happens when both header and cookie exist
        console.log('\n4. Testing priority - header vs cookie...');
        const response4 = await makeRequest('/api/auth/me', {
            headers: {
                'x-user-email': 'peskov142@mail.ru',
                'Cookie': 'impersonate=indianocean635%40gmail.com'
            }
        });
        console.log(`Status: ${response4.status}`);
        if (response4.status === 200) {
            try {
                const data = JSON.parse(response4.data);
                const user = data.user || data;
                console.log(`Both header+cookie - User returned: ${user.email}`);
                if (user.email === 'indianocean635@gmail.com') {
                    console.log('PROBLEM: Cookie has higher priority than header!');
                    console.log('This explains why normal login shows wrong user after impersonation');
                } else if (user.email === 'peskov142@mail.ru') {
                    console.log('GOOD: Header has higher priority than cookie');
                }
            } catch (e) {
                console.log('Response not valid JSON');
            }
        }
        
    } catch (error) {
        console.log(`Test error: ${error.message}`);
    }
    
    console.log('\n=== BROWSER STATE TEST COMPLETE ===');
    console.log('\nIf cookie has higher priority, the issue is in authRoutes.js');
    console.log('The middleware should prioritize header over cookie for normal login');
}

testBrowserState();
