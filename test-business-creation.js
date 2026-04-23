#!/usr/bin/env node

/**
 * Business Creation Test - Tests if users have proper business records
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

async function testBusinessCreation() {
    console.log('=== BUSINESS CREATION TEST ===');
    
    try {
        // Test 1: Check if peskov142@mail.ru has business record
        console.log('1. Checking if peskov142@mail.ru has business record...');
        const response1 = await makeRequest('/api/business', {
            headers: {
                'x-user-email': 'peskov142@mail.ru'
            }
        });
        console.log(`peskov142@mail.ru business status: ${response1.status}`);
        
        if (response1.status === 200) {
            try {
                const business = JSON.parse(response1.data);
                console.log('peskov142@mail.ru business data:', business);
                console.log('Business ID:', business.id);
                console.log('Business Name:', business.name);
            } catch (e) {
                console.log('Response not valid JSON:', response1.data.substring(0, 100));
            }
        } else if (response1.status === 404) {
            console.log('peskov142@mail.ru has NO business record - THIS IS THE PROBLEM!');
        } else if (response1.status === 401) {
            console.log('peskov142@mail.ru authentication failed');
        } else {
            console.log('Unexpected status:', response1.status);
            console.log('Error:', response1.data.substring(0, 100));
        }
        
        // Test 2: Check if indianocean635@gmail.com has business record
        console.log('\n2. Checking if indianocean635@gmail.com has business record...');
        const response2 = await makeRequest('/api/business', {
            headers: {
                'x-user-email': 'indianocean635@gmail.com'
            }
        });
        console.log(`indianocean635@gmail.com business status: ${response2.status}`);
        
        if (response2.status === 200) {
            try {
                const business = JSON.parse(response2.data);
                console.log('indianocean635@gmail.com business data:', business);
                console.log('Business ID:', business.id);
                console.log('Business Name:', business.name);
            } catch (e) {
                console.log('Response not valid JSON:', response2.data.substring(0, 100));
            }
        } else if (response2.status === 404) {
            console.log('indianocean635@gmail.com has NO business record');
        } else {
            console.log('Status:', response2.status);
        }
        
        // Test 3: Try to create business for peskov142@mail.ru
        console.log('\n3. Testing business creation for peskov142@mail.ru...');
        const createResponse = await makeRequest('/api/business', {
            method: 'POST',
            headers: {
                'x-user-email': 'peskov142@mail.ru',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Test Business for peskov142',
                phone: '+7 (444) - 444 - 44 - 44',
                address: 'Test Address'
            })
        });
        console.log(`Business creation status: ${createResponse.status}`);
        
        if (createResponse.status === 200 || createResponse.status === 201) {
            try {
                const newBusiness = JSON.parse(createResponse.data);
                console.log('Created business:', newBusiness);
                console.log('Business ID:', newBusiness.id);
            } catch (e) {
                console.log('Creation response not valid JSON:', createResponse.data.substring(0, 100));
            }
        } else {
            console.log('Business creation failed:', createResponse.status);
            console.log('Error:', createResponse.data.substring(0, 200));
        }
        
        // Test 4: Check if business creation fixed the issue
        console.log('\n4. Checking if business creation fixed the issue...');
        const checkResponse = await makeRequest('/api/business', {
            headers: {
                'x-user-email': 'peskov142@mail.ru'
            }
        });
        console.log(`After creation - peskov142@mail.ru business status: ${checkResponse.status}`);
        
        if (checkResponse.status === 200) {
            try {
                const business = JSON.parse(checkResponse.data);
                console.log('peskov142@mail.ru now has business:', business);
                console.log('SUCCESS: Business isolation should now work!');
            } catch (e) {
                console.log('Check response not valid JSON');
            }
        }
        
    } catch (error) {
        console.log(`Test error: ${error.message}`);
    }
    
    console.log('\n=== BUSINESS CREATION TEST COMPLETE ===');
    console.log('\nIf peskov142@mail.ru had no business record:');
    console.log('1. This explains why settings affected other users');
    console.log('2. System was falling back to default/shared business');
    console.log('3. Creating individual business records should fix the issue');
    console.log('4. Check user registration/business creation process');
}

testBusinessCreation();
