#!/usr/bin/env node

/**
 * Check Business Endpoints - Find available business API endpoints
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

async function checkBusinessEndpoints() {
    console.log('=== CHECKING BUSINESS ENDPOINTS ===');
    
    const endpoints = [
        { method: 'GET', path: '/api/business', desc: 'Get business details' },
        { method: 'POST', path: '/api/business', desc: 'Create business' },
        { method: 'PUT', path: '/api/business', desc: 'Update business' },
        { method: 'GET', path: '/api/business/slug', desc: 'Get business slug' },
        { method: 'POST', path: '/api/business/create', desc: 'Create business (alternative)' },
        { method: 'POST', path: '/api/business/new', desc: 'Create business (alternative 2)' },
        { method: 'POST', path: '/api/settings/business', desc: 'Create business via settings' },
        { method: 'PUT', path: '/api/settings/business', desc: 'Update business via settings' }
    ];
    
    const testEmail = 'peskov142@mail.ru';
    
    for (const endpoint of endpoints) {
        console.log(`\n--- ${endpoint.method} ${endpoint.path} ---`);
        console.log(`Description: ${endpoint.desc}`);
        
        try {
            const options = {
                headers: {
                    'x-user-email': testEmail
                }
            };
            
            if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
                options.method = endpoint.method;
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify({
                    name: 'Test Business',
                    phone: '+7 (000) - 000 - 00 - 00',
                    address: 'Test Address'
                });
            }
            
            const response = await makeRequest(endpoint.path, options);
            
            if (response.status === 200) {
                console.log(`✅ EXISTS - Status: ${response.status}`);
                if (endpoint.method === 'GET') {
                    try {
                        const data = JSON.parse(response.data);
                        console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}...`);
                    } catch (e) {
                        console.log('   Response: Not JSON');
                    }
                } else {
                    console.log(`   Response: ${response.data.substring(0, 100)}...`);
                }
            } else if (response.status === 404) {
                console.log(`❌ NOT FOUND - Status: ${response.status}`);
                console.log(`   Error: ${response.data.substring(0, 100)}`);
            } else if (response.status === 401) {
                console.log(`⚠️  AUTH ERROR - Status: ${response.status}`);
                console.log(`   Error: ${response.data.substring(0, 100)}`);
            } else if (response.status === 405) {
                console.log(`⚠️  METHOD NOT ALLOWED - Status: ${response.status}`);
                console.log(`   Error: ${response.data.substring(0, 100)}`);
            } else {
                console.log(`? UNKNOWN - Status: ${response.status}`);
                console.log(`   Error: ${response.data.substring(0, 100)}`);
            }
            
        } catch (error) {
            console.log(`❌ REQUEST ERROR: ${error.message}`);
        }
    }
    
    console.log('\n=== CHECKING BUSINESS ROUTES FILE ===');
    console.log('Need to check routes/businessRoutes.js for available endpoints');
    
    console.log('\n=== ALTERNATIVE APPROACH ===');
    console.log('If no POST endpoint exists, we might need to:');
    console.log('1. Create the missing endpoint in businessRoutes.js');
    console.log('2. Use a different endpoint path');
    console.log('3. Create business directly via database');
    
    console.log('\n=== ENDPOINT CHECK COMPLETE ===');
}

checkBusinessEndpoints();
