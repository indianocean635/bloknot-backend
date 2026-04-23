#!/usr/bin/env node

/**
 * Simple Cookie Test for Server
 * Tests impersonate cookie functionality on server
 */

const https = require('https');
const http = require('http');

async function makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, 'https://bloknotservis.ru');
        const lib = url.protocol === 'https:' ? https : http;
        
        const req = lib.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: data,
                    cookies: parseCookies(res.headers['set-cookie'] || [])
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

function parseCookies(setCookieHeader) {
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

async function testCookie() {
    console.log('=== COOKIE TEST ON SERVER ===');
    
    try {
        // Test 1: Impersonation
        console.log('Testing impersonation...');
        const testUserId = '573f991e-12a3-4c37-96a4-86d006fa3376';
        const response = await makeRequest(`/api/admin/impersonate/${testUserId}`, {
            redirect: 'manual'
        });
        
        if (response.status >= 300 && response.status < 400) {
            console.log('Impersonation redirect: SUCCESS');
            console.log(`Redirect to: ${response.headers.location}`);
            
            const impersonateCookie = response.cookies.find(c => c.name === 'impersonate');
            if (impersonateCookie) {
                console.log(`Cookie set: ${impersonateCookie.name}=${impersonateCookie.value}`);
                
                // Test 2: API call with cookie
                console.log('Testing API call with cookie...');
                const apiResponse = await makeRequest('/api/auth/me', {
                    headers: {
                        'Cookie': `impersonate=${impersonateCookie.value}`
                    }
                });
                
                console.log(`API call status: ${apiResponse.status}`);
                if (apiResponse.status === 200) {
                    try {
                        const data = JSON.parse(apiResponse.data);
                        console.log(`API response: ${data.email || 'No email'}`);
                        console.log('SUCCESS: Impersonation working!');
                    } catch (parseError) {
                        console.log('API response: NOT JSON');
                    }
                } else {
                    console.log(`API failed: ${apiResponse.status}`);
                    console.log('Error:', apiResponse.data.substring(0, 100));
                }
            } else {
                console.log('Cookie: NOT SET');
            }
        } else {
            console.log(`Impersonation failed: ${response.status}`);
        }
    } catch (error) {
        console.log(`Test error: ${error.message}`);
    }
    
    console.log('=== TEST COMPLETE ===');
}

testCookie();
