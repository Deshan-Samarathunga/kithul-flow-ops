import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

async function runTriggerFix() {
  try {
    console.log('🔧 Running database trigger fix...');
    
    const sqlFile = path.join(process.cwd(), '..', 'db', '006_fix_database_triggers.sql');
    
    // Try different PostgreSQL connection methods
    const commands = [
      `psql -d kithul_flow_ops -f "${sqlFile}"`,
      `psql -U postgres -d kithul_flow_ops -f "${sqlFile}"`,
      `psql -h localhost -U postgres -d kithul_flow_ops -f "${sqlFile}"`
    ];
    
    for (const cmd of commands) {
      try {
        console.log(`Trying: ${cmd}`);
        const { stdout, stderr } = await execAsync(cmd);
        
        if (stdout) console.log('Output:', stdout);
        if (stderr && !stderr.includes('password')) console.log('Error:', stderr);
        
        console.log('✅ Database trigger fix completed successfully!');
        return;
      } catch (error: any) {
        if (error.message.includes('password')) {
          console.log('❌ Password authentication failed, trying next method...');
          continue;
        }
        if (error.message.includes('psql')) {
          console.log('❌ psql command not found, trying next method...');
          continue;
        }
        throw error;
      }
    }
    
    console.log('❌ Could not connect to database. Please run the SQL file manually:');
    console.log(`   psql -d kithul_flow_ops -f "${sqlFile}"`);
    console.log('   Or run the SQL commands directly in your PostgreSQL client.');
    
  } catch (error) {
    console.error('❌ Error running trigger fix:', error);
  }
}

runTriggerFix();
