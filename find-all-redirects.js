#!/usr/bin/env node

/**
 * Find All Redirects - Comprehensive search for all redirect patterns
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

function findAllRedirects(htmlContent) {
    const redirects = [];
    const lines = htmlContent.split('\n');
    
    lines.forEach((line, index) => {
        // Pattern 1: window.location.href
        if (line.includes('window.location.href')) {
            redirects.push({
                line: index + 1,
                type: 'window.location.href',
                code: line.trim(),
                active: !line.trim().startsWith('//') && !line.trim().startsWith('/*')
            });
        }
        
        // Pattern 2: window.location.replace
        if (line.includes('window.location.replace')) {
            redirects.push({
                line: index + 1,
                type: 'window.location.replace',
                code: line.trim(),
                active: !line.trim().startsWith('//') && !line.trim().startsWith('/*')
            });
        }
        
        // Pattern 3: location.href
        if (line.includes('location.href') && !line.includes('window.location.href')) {
            redirects.push({
                line: index + 1,
                type: 'location.href',
                code: line.trim(),
                active: !line.trim().startsWith('//') && !line.trim().startsWith('/*')
            });
        }
        
        // Pattern 4: location.replace
        if (line.includes('location.replace') && !line.includes('window.location.replace')) {
            redirects.push({
                line: index + 1,
                type: 'location.replace',
                code: line.trim(),
                active: !line.trim().startsWith('//') && !line.trim().startsWith('/*')
            });
        }
    });
    
    return redirects;
}

function findRedirectFunctions(htmlContent) {
    const redirects = [];
    
    // Find functions that might redirect
    const functionRegex = /function\s+\w+\([^)]*\)\s*\{[^}]*window\.location[^}]*\}/g;
    let match;
    while ((match = functionRegex.exec(htmlContent)) !== null) {
        redirects.push({
            type: 'function redirect',
            code: match[0].substring(0, 100) + '...'
        });
    }
    
    return redirects;
}

async function findAllRedirectsTest() {
    console.log('=== FIND ALL REDIRECTS TEST ===');
    
    try {
        console.log('Getting dashboard.html...');
        const response = await makeRequest('/dashboard.html?logged=1&v=20260420-1');
        
        if (response.status === 200) {
            console.log('Dashboard loaded successfully');
            
            // Find all redirects
            const redirects = findAllRedirects(response.data);
            console.log(`\nFound ${redirects.length} redirect patterns:`);
            
            redirects.forEach((redirect, index) => {
                const status = redirect.active ? 'ACTIVE' : 'COMMENTED';
                console.log(`${index + 1}. Line ${redirect.line}: ${redirect.type} (${status})`);
                console.log(`   ${redirect.code}`);
            });
            
            // Find redirect functions
            const functionRedirects = findRedirectFunctions(response.data);
            console.log(`\nFound ${functionRedirects.length} redirect functions:`);
            
            functionRedirects.forEach((redirect, index) => {
                console.log(`${index + 1}. ${redirect.type}`);
                console.log(`   ${redirect.code}`);
            });
            
            // Check for app.js loading
            if (response.data.includes('app.js')) {
                console.log('\nApp.js loading: PRESENT');
                
                // Check app.js version
                if (response.data.includes('app.js?v=20260420-1&t=1713633600')) {
                    console.log('App.js version: CORRECT');
                } else {
                    console.log('App.js version: WRONG - old version cached');
                }
            } else {
                console.log('\nApp.js loading: MISSING');
            }
            
            // Check for specific redirect targets
            if (response.data.includes('href = \'/\'')) {
                console.log('\nFOUND: Redirect to main page "/"');
            }
            
            if (response.data.includes('href = \'/index.html\'')) {
                console.log('FOUND: Redirect to index.html');
            }
            
        } else {
            console.log(`Failed to load dashboard: ${response.status}`);
        }
        
    } catch (error) {
        console.log(`Error: ${error.message}`);
    }
    
    console.log('\n=== FIND ALL REDIRECTS COMPLETE ===');
}

findAllRedirectsTest();
