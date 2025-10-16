import { pool } from '../src/db.js';

async function fixTriggerViaServer() {
  try {
    console.log('🔧 Using server database connection to fix trigger...');
    
    console.log('🔍 Checking for existing triggers and functions...');
    
    // Check for triggers
    const triggerCheck = await pool.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'buckets'
    `);
    
    console.log('📋 Found triggers on buckets table:');
    triggerCheck.rows.forEach(row => {
      console.log(`  - ${row.trigger_name}`);
    });
    
    // Check for functions
    const functionCheck = await pool.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname LIKE '%total_amount%' OR proname LIKE '%calculate%'
    `);
    
    console.log('📋 Found related functions:');
    functionCheck.rows.forEach(row => {
      console.log(`  - ${row.proname}`);
    });
    
    console.log('🗑️ Dropping problematic trigger and function...');
    
    // Drop trigger
    await pool.query('DROP TRIGGER IF EXISTS calculate_total_amount_trigger ON buckets;');
    console.log('✅ Dropped calculate_total_amount_trigger');
    
    // Drop function
    await pool.query('DROP FUNCTION IF EXISTS calculate_total_amount();');
    console.log('✅ Dropped calculate_total_amount function');
    
    // Drop any other related functions
    await pool.query('DROP FUNCTION IF EXISTS calculate_total_amount() CASCADE;');
    console.log('✅ Dropped calculate_total_amount function with CASCADE');
    
    // Try to drop any function that might be causing issues
    await pool.query(`
      DROP FUNCTION IF EXISTS calculate_total_amount() CASCADE;
      DROP FUNCTION IF EXISTS public.calculate_total_amount() CASCADE;
    `);
    console.log('✅ Dropped all variations of calculate_total_amount function');
    
    // Verify they're gone
    const finalTriggerCheck = await pool.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'buckets'
    `);
    
    const finalFunctionCheck = await pool.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname = 'calculate_total_amount'
    `);
    
    console.log('🔍 Final verification:');
    console.log(`  - Triggers on buckets: ${finalTriggerCheck.rows.length}`);
    console.log(`  - calculate_total_amount function: ${finalFunctionCheck.rows.length}`);
    
    if (finalTriggerCheck.rows.length === 0 && finalFunctionCheck.rows.length === 0) {
      console.log('✅ SUCCESS! All problematic triggers and functions removed!');
      console.log('🔄 Please restart your server to ensure changes take effect.');
    } else {
      console.log('⚠️ Some triggers/functions may still exist');
      console.log('Remaining triggers:', finalTriggerCheck.rows.map(r => r.trigger_name));
      console.log('Remaining functions:', finalFunctionCheck.rows.map(r => r.proname));
    }
    
  } catch (error) {
    console.error('❌ Error fixing triggers:', error);
  } finally {
    // Don't end the pool as it's shared with the server
    console.log('✅ Script completed. Server connection remains active.');
  }
}

fixTriggerViaServer();
