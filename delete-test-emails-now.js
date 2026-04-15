#!/usr/bin/env node

/**
 * Direct script to delete test emails via API calls
 * Run this on the server after deployment
 */

const testEmails = [
  'alyona.shadrina.9890@gmail.com',
  'reklama-media-kitchen@mail.ru', 
  'peskov142@mail.ru',
  'agent_123@internet.ru'
];

async function deleteTestEmails() {
  console.log('=== DELETING TEST EMAILS ===');
  
  for (const email of testEmails) {
    try {
      console.log(`\nDeleting: ${email}`);
      
      // Get user by email via admin API
      const usersResponse = await fetch('http://localhost:3000/api/admin/users', {
        headers: {
          'x-admin-email': 'admin@bloknotservis.ru',
          'x-admin-logged-in': 'true'
        }
      });
      
      if (!usersResponse.ok) {
        console.log(`  - Failed to get users: ${usersResponse.status}`);
        continue;
      }
      
      const users = await usersResponse.json();
      const user = users.find(u => u.email === email);
      
      if (!user) {
        console.log(`  - User not found`);
        continue;
      }
      
      // Delete user
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
        console.log(`  - Failed to delete: ${error.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error(`  - Error deleting ${email}:`, error.message);
    }
  }
  
  console.log('\n=== DELETION COMPLETE ===');
}

if (require.main === module) {
  deleteTestEmails().catch(console.error);
}

module.exports = deleteTestEmails;
