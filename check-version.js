#!/usr/bin/env node

/**
 * Version Check - Checks which version of dashboard.html is actually served
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

async function checkVersion() {
    console.log('=== VERSION CHECK ===');
    
    try {
        console.log('Getting dashboard.html without cache-busting...');
        const response1 = await makeRequest('/dashboard.html');
        
        console.log('Getting dashboard.html with cache-busting...');
        const response2 = await makeRequest('/dashboard.html?logged=1&v=20260420-1');
        
        console.log('\n=== WITHOUT CACHE-BUSTING ===');
        console.log(`Status: ${response1.status}`);
        console.log(`Has logging: ${response1.data.includes('DASHBOARD HTML: Page started loading')}`);
        console.log(`Has redirect: ${response1.data.includes('window.location.href = \'/\'')}`);
        console.log(`Redirect commented: ${response1.data.includes('// window.location.href = \'/\'')}`);
        
        console.log('\n=== WITH CACHE-BUSTING ===');
        console.log(`Status: ${response2.status}`);
        console.log(`Has logging: ${response2.data.includes('DASHBOARD HTML: Page started loading')}`);
        console.log(`Has redirect: ${response2.data.includes('window.location.href = \'/\'')}`);
        console.log(`Redirect commented: ${response2.data.includes('// window.location.href = \'/\'')}`);
        
        // Find exact line with redirect
        const lines = response2.data.split('\n');
        lines.forEach((line, index) => {
            if (line.includes('window.location.href') && line.includes('/')) {
                console.log(`\nFound redirect at line ${index + 1}:`);
                console.log(`${index + 1}: ${line.trim()}`);
            }
        });
        
    } catch (error) {
        console.log(`Error: ${error.message}`);
    }
    
    console.log('\n=== VERSION CHECK COMPLETE ===');
}

checkVersion();
