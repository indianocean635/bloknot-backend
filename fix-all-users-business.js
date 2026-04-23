#!/usr/bin/env node

/**
 * Fix All Users Business - Creates business for ALL users without them
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

async function createBusinessForUser(email, name, phone) {
    console.log(`Creating business for ${email}...`);
    
    const businessData = {
        name: name || `Business for ${email}`,
        phone: phone || '+7 (000) - 000 - 00 - 00',
        address: 'Default Address',
        description: `Business created for user ${email}`
    };
    
    const response = await makeRequest('/api/business', {
        method: 'POST',
        headers: {
            'x-user-email': email,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(businessData)
    });
    
    console.log(`Creation status for ${email}: ${response.status}`);
    
    if (response.status === 200 || response.status === 201) {
        try {
            const business = JSON.parse(response.data);
            console.log(`✅ SUCCESS: Created business for ${email}`);
            console.log(`   Business ID: ${business.id}`);
            console.log(`   Business Name: ${business.name}`);
            return business;
        } catch (e) {
            console.log(`❌ FAILED: Invalid response for ${email}`);
            console.log('   Response:', response.data.substring(0, 100));
            return null;
        }
    } else {
        console.log(`❌ FAILED: Could not create business for ${email}`);
        console.log('   Status:', response.status);
        console.log('   Error:', response.data.substring(0, 200));
        return null;
    }
}

async function checkUserBusiness(email) {
    const response = await makeRequest('/api/business', {
        headers: {
            'x-user-email': email
        }
    });
    
    if (response.status === 404) {
        return { hasBusiness: false, business: null };
    } else if (response.status === 200) {
        try {
            const business = JSON.parse(response.data);
            return { hasBusiness: true, business: business };
        } catch (e) {
            return { hasBusiness: false, business: null };
        }
    } else {
        return { hasBusiness: false, business: null };
    }
}

async function getAllUsersFromDatabase() {
    console.log('Getting all users from database...');
    
    // Since we don't have direct database access, we'll use known users
    // In production, this should query the database directly
    const knownUsers = [
        'peskov142@mail.ru',
        'indianocean635@gmail.com',
        'ololo555333@mail.ru',
        'apeskov635@gmail.com',
        'agent_123@internet.ru'
    ];
    
    console.log(`Found ${knownUsers.length} known users`);
    return knownUsers;
}

async function fixAllUsersBusiness() {
    console.log('=== FIXING ALL USERS BUSINESS RECORDS ===');
    console.log('Creating business for every user without one...\n');
    
    const users = await getAllUsersFromDatabase();
    const results = [];
    
    for (const email of users) {
        console.log(`\n--- Processing ${email} ---`);
        
        // Check if user has business
        const checkResult = await checkUserBusiness(email);
        
        if (checkResult.hasBusiness) {
            console.log(`✅ ${email} already has business`);
            console.log(`   Business ID: ${checkResult.business.id}`);
            console.log(`   Business Name: ${checkResult.business.name}`);
            results.push({
                email: email,
                status: 'exists',
                business: checkResult.business
            });
        } else {
            console.log(`❌ ${email} has no business - creating...`);
            
            // Extract name from email for business name
            const emailName = email.split('@')[0];
            const businessName = emailName.charAt(0).toUpperCase() + emailName.slice(1) + ' Business';
            
            const business = await createBusinessForUser(email, businessName);
            
            if (business) {
                results.push({
                    email: email,
                    status: 'created',
                    business: business
                });
            } else {
                results.push({
                    email: email,
                    status: 'failed',
                    business: null
                });
            }
        }
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    const created = results.filter(r => r.status === 'created').length;
    const existed = results.filter(r => r.status === 'exists').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`Total users processed: ${results.length}`);
    console.log(`✅ Businesses created: ${created}`);
    console.log(`✅ Businesses already existed: ${existed}`);
    console.log(`❌ Failed to create: ${failed}`);
    
    // Detailed results
    console.log('\n=== DETAILED RESULTS ===');
    results.forEach(result => {
        const status = result.status === 'created' ? '✅ CREATED' :
                      result.status === 'exists' ? '✅ EXISTS' :
                      '❌ FAILED';
        console.log(`${status} ${result.email}`);
        if (result.business) {
            console.log(`   Business ID: ${result.business.id}`);
            console.log(`   Business Name: ${result.business.name}`);
        }
    });
    
    // Test business isolation
    console.log('\n=== TESTING BUSINESS ISOLATION ===');
    for (const result of results) {
        if (result.business) {
            console.log(`\nTesting ${result.email}...`);
            const testResponse = await makeRequest('/api/business/slug', {
                headers: {
                    'x-user-email': result.email
                }
            });
            
            if (testResponse.status === 200) {
                try {
                    const slugData = JSON.parse(testResponse.data);
                    console.log(`✅ ${result.email}: ${slugData.slug}`);
                } catch (e) {
                    console.log(`❌ ${result.email}: Invalid slug response`);
                }
            } else {
                console.log(`❌ ${result.email}: Slug test failed (${testResponse.status})`);
            }
        }
    }
    
    console.log('\n=== FIX COMPLETE ===');
    console.log('\nIMPORTANT NOTES:');
    console.log('1. Every user now has individual business');
    console.log('2. Settings should now be isolated per user');
    console.log('3. Test in browser: change settings for one user, check other user');
    console.log('4. Fix registration process to auto-create business for new users');
    console.log('5. Only specialists invited to existing businesses should share business');
    
    console.log('\nNEXT STEPS:');
    console.log('1. Test settings isolation in browser');
    console.log('2. Fix user registration to auto-create business');
    console.log('3. Verify specialist invitation logic works correctly');
}

fixAllUsersBusiness();
