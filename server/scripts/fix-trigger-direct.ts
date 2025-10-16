import pg from 'pg';

const { Pool } = pg;

async function fixTriggerDirect() {
  let pool;
  
  try {
    console.log('🔧 Connecting to database to fix trigger...');
    
    // Try different connection configurations
    const connectionConfigs = [
      {
        user: 'postgres',
        host: 'localhost',
        database: 'kithul_flow_ops',
        password: 'password',
        port: 5432,
        ssl: false
      },
      {
        user: 'postgres',
        host: 'localhost',
        database: 'kithul_flow_ops',
        password: '',
        port: 5432,
        ssl: false
      },
      {
        user: 'postgres',
        host: 'localhost',
        database: 'kithul_flow_ops',
        password: 'postgres',
        port: 5432,
        ssl: false
      }
    ];
    
    for (const config of connectionConfigs) {
      try {
        console.log(`Trying connection with password: ${config.password || 'empty'}`);
        pool = new Pool(config);
        
        // Test connection
        await pool.query('SELECT 1');
        console.log('✅ Database connection successful!');
        break;
      } catch (error: any) {
        console.log(`❌ Connection failed: ${error.message}`);
        if (pool) {
          await pool.end();
          pool = null;
        }
      }
    }
    
    if (!pool) {
      throw new Error('Could not connect to database with any configuration');
    }
    
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
    } else {
      console.log('⚠️ Some triggers/functions may still exist');
    }
    
  } catch (error) {
    console.error('❌ Error fixing triggers:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

fixTriggerDirect();
