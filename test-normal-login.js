#!/usr/bin/env node

/**
 * Normal Login Test - Tests regular login authentication
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

async function testNormalLogin() {
    console.log('=== NORMAL LOGIN TEST ===');
    
    try {
        // Test 1: Check /api/auth/me without any authentication
        console.log('1. Testing /api/auth/me without authentication...');
        const response1 = await makeRequest('/api/auth/me');
        console.log(`Status: ${response1.status}`);
        if (response1.status === 401) {
            console.log('GOOD: Requires authentication');
        } else {
            console.log('PROBLEM: Should require authentication but returns:', response1.data.substring(0, 100));
        }
        
        // Test 2: Check /api/auth/me with peskov142@mail.ru header
        console.log('\n2. Testing /api/auth/me with peskov142@mail.ru header...');
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
                console.log(`User returned: ${user.email}`);
                if (user.email === 'peskov142@mail.ru') {
                    console.log('GOOD: Returns correct user');
                } else {
                    console.log('PROBLEM: Returns wrong user!');
                    console.log(`Expected: peskov142@mail.ru`);
                    console.log(`Got: ${user.email}`);
                }
            } catch (e) {
                console.log('Response not valid JSON:', response2.data.substring(0, 100));
            }
        } else {
            console.log('Failed with status:', response2.status);
            console.log('Error:', response2.data.substring(0, 100));
        }
        
        // Test 3: Check if there's any hardcoded fallback
        console.log('\n3. Testing for hardcoded fallback...');
        const response3 = await makeRequest('/api/auth/me', {
            headers: {
                'x-user-email': 'nonexistent@test.com'
            }
        });
        console.log(`Status: ${response3.status}`);
        if (response3.status === 200) {
            try {
                const data = JSON.parse(response3.data);
                const user = data.user || data;
                console.log(`Nonexistent user returned: ${user.email}`);
                if (user.email === 'indianocean635@gmail.com') {
                    console.log('PROBLEM: Hardcoded fallback to indianocean635@gmail.com!');
                }
            } catch (e) {
                console.log('Response not valid JSON');
            }
        } else {
            console.log('GOOD: Nonexistent user properly rejected');
        }
        
        // Test 4: Check middleware logic
        console.log('\n4. Testing middleware priority...');
        
        // Without any headers
        const response4a = await makeRequest('/api/auth/me');
        console.log(`No headers - Status: ${response4a.status}`);
        
        // With x-user-email header
        const response4b = await makeRequest('/api/auth/me', {
            headers: {
                'x-user-email': 'peskov142@mail.ru'
            }
        });
        console.log(`With x-user-email - Status: ${response4b.status}`);
        
        // With impersonate cookie
        const response4c = await makeRequest('/api/auth/me', {
            headers: {
                'Cookie': 'impersonate=peskov142%40mail.ru'
            }
        });
        console.log(`With impersonate cookie - Status: ${response4c.status}`);
        
    } catch (error) {
        console.log(`Test error: ${error.message}`);
    }
    
    console.log('\n=== NORMAL LOGIN TEST COMPLETE ===');
    console.log('\nIf tests show wrong user, check authRoutes.js middleware logic');
    console.log('The issue might be in the order of checking req.cookies vs req.headers');
}

testNormalLogin();
