#!/usr/bin/env node

/**
 * Browser Debug Test - Simulates browser behavior to find JavaScript redirect
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

function findJavaScriptRedirects(htmlContent) {
    const redirects = [];
    
    // Find window.location.href assignments
    const locationRegex = /window\.location\.href\s*=\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = locationRegex.exec(htmlContent)) !== null) {
        redirects.push({
            type: 'window.location.href',
            target: match[1],
            line: htmlContent.substring(0, match.index).split('\n').length
        });
    }
    
    // Find window.location.replace
    const replaceRegex = /window\.location\.replace\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = replaceRegex.exec(htmlContent)) !== null) {
        redirects.push({
            type: 'window.location.replace',
            target: match[1],
            line: htmlContent.substring(0, match.index).split('\n').length
        });
    }
    
    return redirects;
}

function findConditionalRedirects(htmlContent) {
    const redirects = [];
    
    // Find if statements that might redirect
    const ifRegex = /if\s*\([^)]+\)\s*\{[^}]*window\.location[^}]*\}/g;
    let match;
    while ((match = ifRegex.exec(htmlContent)) !== null) {
        redirects.push({
            type: 'conditional redirect',
            code: match[0],
            line: htmlContent.substring(0, match.index).split('\n').length
        });
    }
    
    return redirects;
}

async function testJavaScriptBehavior() {
    console.log('=== JAVASCRIPT DEBUG TEST ===');
    
    try {
        console.log('Getting dashboard.html content...');
        const response = await makeRequest('/dashboard.html?logged=1&v=20260420-1');
        
        if (response.status === 200) {
            console.log('Dashboard loaded successfully');
            
            // Find all JavaScript redirects
            const redirects = findJavaScriptRedirects(response.data);
            console.log(`\nFound ${redirects.length} JavaScript redirects:`);
            
            redirects.forEach((redirect, index) => {
                console.log(`${index + 1}. ${redirect.type} -> "${redirect.target}" (line ${redirect.line})`);
            });
            
            // Find conditional redirects
            const conditionalRedirects = findConditionalRedirects(response.data);
            console.log(`\nFound ${conditionalRedirects.length} conditional redirects:`);
            
            conditionalRedirects.forEach((redirect, index) => {
                console.log(`${index + 1}. ${redirect.type} (line ${redirect.line}):`);
                console.log(`   ${redirect.code.substring(0, 100)}...`);
            });
            
            // Check for specific problematic patterns
            if (response.data.includes('window.location.href = \'/\'')) {
                console.log('\nFOUND: window.location.href = \'/\' - This redirects to main page!');
            }
            
            if (response.data.includes('if (!user || !user.email)')) {
                console.log('\nFOUND: User validation check - might redirect if user data is invalid');
            }
            
            // Check if our logging is present
            if (response.data.includes('DASHBOARD: Starting loadDashboard function')) {
                console.log('\nLoadDashboard logging: PRESENT');
            } else {
                console.log('\nLoadDashboard logging: MISSING');
            }
            
            // Check for API call
            if (response.data.includes('Bloknot.api("/api/auth/me")')) {
                console.log('API call: PRESENT');
            } else {
                console.log('API call: MISSING');
            }
            
        } else {
            console.log(`Failed to load dashboard: ${response.status}`);
        }
        
    } catch (error) {
        console.log(`Test error: ${error.message}`);
    }
    
    console.log('\n=== BROWSER DEBUG INSTRUCTIONS ===');
    console.log('1. Open browser incognito mode');
    console.log('2. Go to admin panel');
    console.log('3. Open Developer Tools (F12)');
    console.log('4. Go to Network tab');
    console.log('5. Click on any email in admin panel');
    console.log('6. Watch for dashboard.html request');
    console.log('7. Check if JavaScript executes or redirects immediately');
    console.log('8. Look for console logs starting with "DASHBOARD:"');
    
    console.log('\n=== TEST COMPLETE ===');
}

testJavaScriptBehavior();
