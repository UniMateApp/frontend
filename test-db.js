// Debug script to test database connections and policies
import { supabase } from './services/supabase.js';

async function testDatabaseAccess() {
  try {
    console.log('Testing database access...');
    
    // Get client
    const client = await supabase();
    
    // Test 1: Try to get current user
    const { data: { user }, error: userError } = await client.auth.getUser();
    console.log('Current user:', user?.id || 'No user');
    
    // Test 2: Try to read profiles table
    const { data: profiles, error: profilesError } = await client
      .from('profiles')
      .select('*')
      .limit(1);
    
    console.log('Profiles query result:', { 
      success: !profilesError, 
      error: profilesError?.message,
      count: profiles?.length || 0 
    });
    
    // Test 3: Try to read lost_found table
    const { data: lostFound, error: lostFoundError } = await client
      .from('lost_found')
      .select('*')
      .limit(1);
    
    console.log('Lost found query result:', { 
      success: !lostFoundError, 
      error: lostFoundError?.message,
      count: lostFound?.length || 0 
    });
    
  } catch (error) {
    console.error('Database test failed:', error);
  }
}

testDatabaseAccess();