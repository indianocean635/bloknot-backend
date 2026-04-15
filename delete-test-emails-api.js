#!/usr/bin/env node

/**
 * Direct API script to delete test emails via admin panel API
 */

const testEmails = [
  'alyona.shadrina.9890@gmail.com',
  'reklama-media-kitchen@mail.ru', 
  'peskov142@mail.ru',
  'agent_123@internet.ru'
];

async function deleteTestEmails() {
  console.log('=== DELETING TEST EMAILS VIA API ===');
  
  // First get all users to find their IDs
  try {
    const usersResponse = await fetch('http://localhost:3000/api/admin/users', {
      headers: {
        'x-admin-email': 'admin@bloknotservis.ru',
        'x-admin-logged-in': 'true'
      }
    });
    
    if (!usersResponse.ok) {
      throw new Error('Failed to fetch users');
    }
    
    const users = await usersResponse.json();
    console.log(`Found ${users.length} users in database`);
    
    for (const email of testEmails) {
      const user = users.find(u => u.email === email);
      
      if (!user) {
        console.log(`User ${email} not found`);
        continue;
      }
      
      console.log(`\nDeleting user: ${email} (ID: ${user.id})`);
      
      try {
        const deleteResponse = await fetch(`http://localhost:3000/api/admin/users/${user.id}`, {
          method: 'DELETE',
          headers: {
            'x-admin-email': 'admin@bloknotservis.ru',
            'x-admin-logged-in': 'true'
          }
        });
        
        if (deleteResponse.ok) {
          console.log(`  - Successfully deleted ${email}`);
        } else {
          const error = await deleteResponse.json().catch(() => ({}));
          console.log(`  - Failed to delete ${email}: ${error.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`  - Error deleting ${email}:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('Error fetching users:', error);
  }
  
  console.log('\n=== DELETION COMPLETE ===');
}

if (require.main === module) {
  deleteTestEmails().catch(console.error);
}

module.exports = deleteTestEmails;
