import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Create a direct database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'kithul_flow_ops',
  password: 'password',
  port: 5432,
  ssl: false
});

async function fixDatabaseTriggers() {
  try {
    console.log('🔧 Fixing database triggers and functions...');
    
    // Drop the problematic trigger and function
    await pool.query('DROP TRIGGER IF EXISTS calculate_total_amount_trigger ON buckets;');
    console.log('✅ Dropped calculate_total_amount_trigger');
    
    await pool.query('DROP FUNCTION IF EXISTS calculate_total_amount();');
    console.log('✅ Dropped calculate_total_amount function');
    
    // Check if there are any other triggers on buckets table
    const triggerQuery = `
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'buckets'
    `;
    
    const { rows: triggers } = await pool.query(triggerQuery);
    
    if (triggers.length > 0) {
      console.log('📋 Found triggers on buckets table:');
      triggers.forEach(trigger => {
        console.log(`  - ${trigger.trigger_name}: ${trigger.event_manipulation}`);
      });
    } else {
      console.log('✅ No triggers found on buckets table');
    }
    
    // Test bucket creation with a simple query
    console.log('🧪 Testing bucket table structure...');
    const testQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'buckets' 
      ORDER BY ordinal_position
    `;
    
    const { rows: columns } = await pool.query(testQuery);
    console.log('📦 Buckets table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(nullable)'}`);
    });
    
    console.log('✅ Database triggers fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing triggers:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

fixDatabaseTriggers().catch(console.error);
