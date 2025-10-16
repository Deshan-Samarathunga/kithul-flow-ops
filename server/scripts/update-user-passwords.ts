import bcrypt from 'bcrypt';
import { pool } from '../src/db.js';

async function updateUserPasswords() {
  try {
    console.log('Updating user passwords...');
    
    // Default password for all users
    const defaultPassword = 'password123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);
    
    // Update all users with the default password
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE password_hash IS NULL',
      [hashedPassword]
    );
    
    console.log(`Updated ${result.rowCount} users with default password: ${defaultPassword}`);
    
    // List all users
    const { rows } = await pool.query('SELECT user_id, name, role FROM users ORDER BY user_id');
    console.log('\nAvailable users:');
    rows.forEach(user => {
      console.log(`- ${user.user_id} (${user.name}) - Role: ${user.role}`);
    });
    
    console.log('\nAll users can now login with password: password123');
    
  } catch (error) {
    console.error('Error updating passwords:', error);
  } finally {
    await pool.end();
  }
}

updateUserPasswords();
