import { pool } from '../src/db.js';

async function checkAndFixDatabase() {
  try {
    console.log('🔍 Checking database state...');
    
    // Check if we can connect
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Check for triggers on buckets table
    console.log('\n📋 Checking for triggers on buckets table...');
    const triggers = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'buckets'
    `);
    
    console.log(`Found ${triggers.rows.length} triggers:`);
    triggers.rows.forEach(trigger => {
      console.log(`  - ${trigger.trigger_name}: ${trigger.event_manipulation}`);
      console.log(`    Action: ${trigger.action_statement}`);
    });
    
    // Check for functions
    console.log('\n📋 Checking for problematic functions...');
    const functions = await pool.query(`
      SELECT proname, prosrc
      FROM pg_proc
      WHERE proname LIKE '%total_amount%' OR proname LIKE '%calculate%'
    `);
    
    console.log(`Found ${functions.rows.length} functions:`);
    functions.rows.forEach(func => {
      console.log(`  - ${func.proname}`);
      if (func.prosrc && func.prosrc.includes('total_amount')) {
        console.log(`    Source: ${func.prosrc.substring(0, 100)}...`);
      }
    });
    
    // If we found problematic triggers or functions, try to remove them
    if (triggers.rows.length > 0 || functions.rows.length > 0) {
      console.log('\n🗑️ Attempting to remove problematic triggers and functions...');
      
      // Remove triggers
      for (const trigger of triggers.rows) {
        try {
          await pool.query(`DROP TRIGGER IF EXISTS ${trigger.trigger_name} ON buckets CASCADE`);
          console.log(`✅ Removed trigger: ${trigger.trigger_name}`);
        } catch (error: any) {
          console.log(`❌ Failed to remove trigger ${trigger.trigger_name}: ${error.message}`);
        }
      }
      
      // Remove functions
      for (const func of functions.rows) {
        try {
          await pool.query(`DROP FUNCTION IF EXISTS ${func.proname}() CASCADE`);
          console.log(`✅ Removed function: ${func.proname}`);
        } catch (error: any) {
          console.log(`❌ Failed to remove function ${func.proname}: ${error.message}`);
        }
      }
      
      // Final verification
      console.log('\n🔍 Final verification...');
      const finalTriggers = await pool.query(`
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'buckets'
      `);
      
      const finalFunctions = await pool.query(`
        SELECT proname
        FROM pg_proc
        WHERE proname LIKE '%total_amount%' OR proname LIKE '%calculate%'
      `);
      
      console.log(`Remaining triggers: ${finalTriggers.rows.length}`);
      console.log(`Remaining functions: ${finalFunctions.rows.length}`);
      
      if (finalTriggers.rows.length === 0 && finalFunctions.rows.length === 0) {
        console.log('✅ SUCCESS! All problematic triggers and functions removed!');
        console.log('🔄 Please restart your server for changes to take effect.');
      } else {
        console.log('⚠️ Some triggers/functions may still exist');
        console.log('You may need to remove them manually from your database client.');
      }
    } else {
      console.log('✅ No problematic triggers or functions found');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

checkAndFixDatabase();
