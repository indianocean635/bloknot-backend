#!/usr/bin/env node

/**
 * Create Business Records - Creates business records for users without them
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

async function createMissingBusinesses() {
    console.log('=== CREATING MISSING BUSINESS RECORDS ===');
    
    const users = [
        {
            email: 'peskov142@mail.ru',
            name: 'Vfuf Business',
            phone: '+7 (444) - 444 - 44 - 44'
        },
        {
            email: 'indianocean635@gmail.com',
            name: 'Rufus Business',
            phone: '+7 (666) - 666 - 66 - 66'
        },
        {
            email: 'ololo555333@mail.ru',
            name: 'GBN Business',
            phone: '+7 (555) - 555 - 55 - 55'
        },
        {
            email: 'apeskov635@gmail.com',
            name: 'Apeskov Business',
            phone: '+7 (777) - 777 - 77 - 77'
        }
    ];
    
    const results = [];
    
    for (const user of users) {
        // First check if user already has business
        console.log(`\nChecking ${user.email}...`);
        const checkResponse = await makeRequest('/api/business', {
            headers: {
                'x-user-email': user.email
            }
        });
        
        if (checkResponse.status === 404) {
            console.log(`User ${user.email} has no business - creating one...`);
            const business = await createBusinessForUser(user.email, user.name, user.phone);
            results.push({
                email: user.email,
                status: business ? 'created' : 'failed',
                business: business
            });
        } else if (checkResponse.status === 200) {
            console.log(`User ${user.email} already has business - skipping`);
            try {
                const existingBusiness = JSON.parse(checkResponse.data);
                results.push({
                    email: user.email,
                    status: 'exists',
                    business: existingBusiness
                });
            } catch (e) {
                results.push({
                    email: user.email,
                    status: 'exists_invalid',
                    business: null
                });
            }
        } else {
            console.log(`Error checking ${user.email}: ${checkResponse.status}`);
            results.push({
                email: user.email,
                status: 'error',
                business: null
            });
        }
    }
    
    // Summary
    console.log('\n=== CREATION SUMMARY ===');
    results.forEach(result => {
        const status = result.status === 'created' ? '✅ CREATED' :
                      result.status === 'exists' ? '✅ EXISTS' :
                      result.status === 'failed' ? '❌ FAILED' : '❌ ERROR';
        console.log(`${status} ${result.email}`);
        if (result.business) {
            console.log(`   Business ID: ${result.business.id}`);
            console.log(`   Business Name: ${result.business.name}`);
        }
    });
    
    // Test isolation after creation
    console.log('\n=== TESTING ISOLATION AFTER CREATION ===');
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
    
    console.log('\n=== CREATION COMPLETE ===');
    console.log('\nNext steps:');
    console.log('1. Test settings isolation in browser');
    console.log('2. Verify each user has individual business');
    console.log('3. Check if settings now save separately');
    console.log('4. Fix registration process to auto-create business');
}

createMissingBusinesses();
