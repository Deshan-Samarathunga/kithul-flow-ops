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

async function setupCompleteSchema() {
  try {
    console.log('Setting up complete database schema...');
    
    // Read the schema file
  const schemaPath = path.join(process.cwd(), '..', 'db', 'full_schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schemaSQL);
    
    console.log('✅ Complete database schema created successfully!');
    
    // Verify tables exist
    const { rows } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📋 Created tables:');
    rows.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check buckets table structure
    const bucketColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'sap_buckets' 
      ORDER BY ordinal_position
    `);

    console.log('\n📦 sap_buckets columns:');
    bucketColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(nullable)'}`);
    });
    
  } catch (error) {
    console.error('❌ Error setting up schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupCompleteSchema().catch(console.error);
