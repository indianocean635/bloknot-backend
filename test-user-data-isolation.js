#!/usr/bin/env node

/**
 * User Data Isolation Test - Tests if user data is properly isolated
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

async function testUserDataIsolation() {
    console.log('=== USER DATA ISOLATION TEST ===');
    
    try {
        // Test 1: Get business data for peskov142@mail.ru
        console.log('1. Testing business data for peskov142@mail.ru...');
        const response1 = await makeRequest('/api/business/slug', {
            headers: {
                'x-user-email': 'peskov142@mail.ru'
            }
        });
        console.log(`Status: ${response1.status}`);
        let peskovBusiness = null;
        if (response1.status === 200) {
            try {
                peskovBusiness = JSON.parse(response1.data);
                console.log('peskov142@mail.ru business data:', peskovBusiness);
            } catch (e) {
                console.log('Response not valid JSON:', response1.data.substring(0, 100));
            }
        } else {
            console.log('Failed to get business data for peskov142@mail.ru');
        }
        
        // Test 2: Get business data for indianocean635@gmail.com
        console.log('\n2. Testing business data for indianocean635@gmail.com...');
        const response2 = await makeRequest('/api/business/slug', {
            headers: {
                'x-user-email': 'indianocean635@gmail.com'
            }
        });
        console.log(`Status: ${response2.status}`);
        let indianBusiness = null;
        if (response2.status === 200) {
            try {
                indianBusiness = JSON.parse(response2.data);
                console.log('indianocean635@gmail.com business data:', indianBusiness);
            } catch (e) {
                console.log('Response not valid JSON:', response2.data.substring(0, 100));
            }
        } else {
            console.log('Failed to get business data for indianocean635@gmail.com');
        }
        
        // Test 3: Compare business data
        console.log('\n3. Comparing business data...');
        if (peskovBusiness && indianBusiness) {
            if (JSON.stringify(peskovBusiness) === JSON.stringify(indianBusiness)) {
                console.log('CRITICAL PROBLEM: Both users have identical business data!');
                console.log('This explains why settings affect all users');
            } else {
                console.log('GOOD: Users have different business data');
            }
        }
        
        // Test 4: Test business update endpoint
        console.log('\n4. Testing business update isolation...');
        const testUpdateData = {
            name: 'Test Name ' + Date.now(),
            phone: '+7 (999) - 999 - 99 - 99'
        };
        
        // Update for peskov142@mail.ru
        console.log('Updating business for peskov142@mail.ru...');
        const updateResponse1 = await makeRequest('/api/business', {
            method: 'PUT',
            headers: {
                'x-user-email': 'peskov142@mail.ru',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testUpdateData)
        });
        console.log(`peskov142@mail.ru update status: ${updateResponse1.status}`);
        
        // Check if indianocean635@gmail.com sees the change
        console.log('Checking if indianocean635@gmail.com sees the change...');
        const checkResponse = await makeRequest('/api/business/slug', {
            headers: {
                'x-user-email': 'indianocean635@gmail.com'
            }
        });
        
        if (checkResponse.status === 200) {
            try {
                const checkData = JSON.parse(checkResponse.data);
                if (checkData.name === testUpdateData.name) {
                    console.log('CRITICAL PROBLEM: Business update affected wrong user!');
                    console.log('peskov142@mail.ru update was visible to indianocean635@gmail.com');
                } else {
                    console.log('GOOD: Business update is properly isolated');
                }
            } catch (e) {
                console.log('Check response not valid JSON');
            }
        }
        
        // Test 5: Check if there's a shared/global business record
        console.log('\n5. Testing for shared business records...');
        const response3 = await makeRequest('/api/business', {
            headers: {
                'x-user-email': 'peskov142@mail.ru'
            }
        });
        console.log(`peskov142@mail.ru business details status: ${response3.status}`);
        
        const response4 = await makeRequest('/api/business', {
            headers: {
                'x-user-email': 'indianocean635@gmail.com'
            }
        });
        console.log(`indianocean635@gmail.com business details status: ${response4.status}`);
        
        if (response3.status === 200 && response4.status === 200) {
            try {
                const business1 = JSON.parse(response3.data);
                const business2 = JSON.parse(response4.data);
                
                if (business1.id === business2.id) {
                    console.log('CRITICAL PROBLEM: Both users share the same business ID!');
                    console.log('This is the root cause of data cross-contamination');
                } else {
                    console.log('GOOD: Users have different business IDs');
                }
            } catch (e) {
                console.log('Business details response not valid JSON');
            }
        }
        
    } catch (error) {
        console.log(`Test error: ${error.message}`);
    }
    
    console.log('\n=== USER DATA ISOLATION TEST COMPLETE ===');
    console.log('\nIf tests show data cross-contamination:');
    console.log('1. Check businessRoutes.js for proper user filtering');
    console.log('2. Verify business creation assigns unique businessId to each user');
    console.log('3. Check middleware for proper business association');
    console.log('4. Verify database schema for proper foreign key constraints');
}

testUserDataIsolation();
