import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function runSQLDirectly() {
  try {
    console.log('🔧 Running SQL commands directly...');
    
    const sqlFile = path.join(process.cwd(), '..', 'db', '007_force_remove_triggers.sql');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    console.log('📄 SQL file content loaded');
    
    // Try to execute using psql with different connection methods
    const commands = [
      `psql -d kithul_flow_ops -c "${sqlContent.replace(/"/g, '\\"')}"`,
      `psql -U postgres -d kithul_flow_ops -c "${sqlContent.replace(/"/g, '\\"')}"`,
      `psql -h localhost -U postgres -d kithul_flow_ops -c "${sqlContent.replace(/"/g, '\\"')}"`
    ];
    
    for (const cmd of commands) {
      try {
        console.log(`Trying: ${cmd.substring(0, 50)}...`);
        const { stdout, stderr } = await execAsync(cmd);
        
        if (stdout) {
          console.log('✅ Output:', stdout);
        }
        if (stderr && !stderr.includes('password') && !stderr.includes('authentication')) {
          console.log('⚠️ Warnings:', stderr);
        }
        
        console.log('✅ SQL commands executed successfully!');
        return;
      } catch (error: any) {
        if (error.message.includes('password') || error.message.includes('authentication')) {
          console.log('❌ Authentication failed, trying next method...');
          continue;
        }
        if (error.message.includes('psql')) {
          console.log('❌ psql command not found, trying next method...');
          continue;
        }
        console.log('❌ Error:', error.message);
        continue;
      }
    }
    
    console.log('❌ Could not execute SQL commands automatically.');
    console.log('📋 Please run the SQL file manually:');
    console.log(`   File: ${sqlFile}`);
    console.log('   Or copy the contents and run them in your PostgreSQL client.');
    
    // Show the SQL content
    console.log('\n📄 SQL Content to run:');
    console.log('=' .repeat(50));
    console.log(sqlContent);
    console.log('=' .repeat(50));
    
  } catch (error) {
    console.error('❌ Error running SQL:', error);
  }
}

runSQLDirectly();
