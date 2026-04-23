#!/usr/bin/env node

/**
 * Test Load Redirect - Checks for redirects that happen during page load
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

function findLoadTimeRedirects(htmlContent) {
    const redirects = [];
    const lines = htmlContent.split('\n');
    
    lines.forEach((line, index) => {
        // Look for redirects in global scope (not inside functions)
        if (line.includes('window.location.href') || line.includes('location.href')) {
            // Check if it's in global scope (not indented)
            const trimmed = line.trim();
            if (trimmed.startsWith('window.location.href') || trimmed.startsWith('location.href')) {
                redirects.push({
                    line: index + 1,
                    type: 'global redirect',
                    code: line.trim(),
                    active: !line.trim().startsWith('//') && !line.trim().startsWith('/*')
                });
            }
        }
    });
    
    return redirects;
}

function findFunctionCalls(htmlContent) {
    const calls = [];
    const lines = htmlContent.split('\n');
    
    lines.forEach((line, index) => {
        // Look for function calls that might redirect
        if (line.includes('loadDashboard()') || line.includes('checkPasswordRequired()')) {
            calls.push({
                line: index + 1,
                type: 'function call',
                code: line.trim()
            });
        }
    });
    
    return calls;
}

async function testLoadRedirect() {
    console.log('=== LOAD REDIRECT TEST ===');
    
    try {
        console.log('Getting dashboard.html...');
        const response = await makeRequest('/dashboard.html?logged=1&v=20260420-1');
        
        if (response.status === 200) {
            console.log('Dashboard loaded successfully');
            
            // Find load-time redirects
            const loadRedirects = findLoadTimeRedirects(response.data);
            console.log(`\nFound ${loadRedirects.length} load-time redirects:`);
            
            loadRedirects.forEach((redirect, index) => {
                const status = redirect.active ? 'ACTIVE' : 'COMMENTED';
                console.log(`${index + 1}. Line ${redirect.line}: ${redirect.type} (${status})`);
                console.log(`   ${redirect.code}`);
            });
            
            // Find function calls
            const functionCalls = findFunctionCalls(response.data);
            console.log(`\nFound ${functionCalls.length} function calls:`);
            
            functionCalls.forEach((call, index) => {
                console.log(`${index + 1}. Line ${call.line}: ${call.type}`);
                console.log(`   ${call.code}`);
            });
            
            // Check if loadDashboard is called at the end
            if (response.data.includes('loadDashboard().catch')) {
                console.log('\nloadDashboard() is called at page end');
            } else {
                console.log('\nloadDashboard() is NOT called at page end');
            }
            
            // Check for specific patterns
            if (response.data.includes('if (!userEmail)')) {
                console.log('\nFOUND: userEmail validation - might redirect');
            }
            
            if (response.data.includes('window.location.href = \'/\'')) {
                console.log('FOUND: Direct redirect to main page');
            }
            
        } else {
            console.log(`Failed to load dashboard: ${response.status}`);
        }
        
    } catch (error) {
        console.log(`Error: ${error.message}`);
    }
    
    console.log('\n=== BROWSER TEST INSTRUCTIONS ===');
    console.log('1. Open browser incognito mode');
    console.log('2. Go to admin panel');
    console.log('3. Open Developer Tools (F12)');
    console.log('4. Go to Console tab');
    console.log('5. Click on any email in admin panel');
    console.log('6. Watch console logs:');
    console.log('   - Should see: "DASHBOARD HTML: Page started loading"');
    console.log('   - Should see: "DASHBOARD: Page loaded, script executing"');
    console.log('   - Should see: "[API] Using impersonate cookie: ..."');
    console.log('7. If you see NO console logs, JavaScript is not executing');
    console.log('8. If you see logs but then redirect, check what happens after API call');
    
    console.log('\n=== LOAD REDIRECT TEST COMPLETE ===');
}

testLoadRedirect();
