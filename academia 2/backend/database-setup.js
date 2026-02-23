// Database Setup Script for ACADEMIA LMS
// Run this to ensure all required tables exist in Supabase

const supabase = require('./utils/db');

async function setupDatabase() {
    console.log('========================================');
    console.log('ACADEMIA LMS - Database Setup');
    console.log('========================================\n');

    const setupResults = [];

    // 1. Check/Create parent_student link table
    console.log('1. Setting up parent_student link table...');
    try {
        const { data, error } = await supabase
            .from('parent_student')
            .select('id')
            .limit(1);
        
        if (error && error.code === '42P01') {
            console.log('   ⚠️ parent_student table does not exist');
            console.log('   📋 Please create it in Supabase SQL Editor:');
            console.log(`
CREATE TABLE parent_student (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);

-- Enable RLS
ALTER TABLE parent_student ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Parents can view their children"
    ON parent_student FOR SELECT
    USING (parent_id = auth.uid());

CREATE POLICY "Admins can manage parent-student links"
    ON parent_student FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    ));
            `);
            setupResults.push({ table: 'parent_student', status: 'needs_manual_creation' });
        } else {
            console.log('   ✅ parent_student table exists\n');
            setupResults.push({ table: 'parent_student', status: 'exists' });
        }
    } catch (err) {
        console.log('   ❌ Error:', err.message, '\n');
        setupResults.push({ table: 'parent_student', status: 'error', error: err.message });
    }

    // 2. Check users table structure
    console.log('2. Checking users table...');
    try {
        const { data, error } = await supabase
            .from('users')
            .select('role')
            .limit(1);
        
        if (error) {
            console.log('   ❌ Error accessing users table:', error.message, '\n');
            setupResults.push({ table: 'users', status: 'error', error: error.message });
        } else {
            console.log('   ✅ users table accessible\n');
            setupResults.push({ table: 'users', status: 'exists' });
        }
    } catch (err) {
        console.log('   ❌ Error:', err.message, '\n');
        setupResults.push({ table: 'users', status: 'error', error: err.message });
    }

    // 3. Check courses table
    console.log('3. Checking courses table...');
    try {
        const { data, error } = await supabase
            .from('courses')
            .select('id')
            .limit(1);
        
        if (error) {
            console.log('   ❌ Error:', error.message, '\n');
            setupResults.push({ table: 'courses', status: 'error', error: error.message });
        } else {
            console.log('   ✅ courses table accessible\n');
            setupResults.push({ table: 'courses', status: 'exists' });
        }
    } catch (err) {
        console.log('   ❌ Error:', err.message, '\n');
        setupResults.push({ table: 'courses', status: 'error', error: err.message });
    }

    // 4. Check enrollments table
    console.log('4. Checking enrollments table...');
    try {
        const { data, error } = await supabase
            .from('enrollments')
            .select('id')
            .limit(1);
        
        if (error) {
            console.log('   ❌ Error:', error.message, '\n');
            setupResults.push({ table: 'enrollments', status: 'error', error: error.message });
        } else {
            console.log('   ✅ enrollments table accessible\n');
            setupResults.push({ table: 'enrollments', status: 'exists' });
        }
    } catch (err) {
        console.log('   ❌ Error:', err.message, '\n');
        setupResults.push({ table: 'enrollments', status: 'error', error: err.message });
    }

    // 5. Check sessions table
    console.log('5. Checking sessions table...');
    try {
        const { data, error } = await supabase
            .from('sessions')
            .select('id')
            .limit(1);
        
        if (error) {
            console.log('   ❌ Error:', error.message, '\n');
            setupResults.push({ table: 'sessions', status: 'error', error: error.message });
        } else {
            console.log('   ✅ sessions table accessible\n');
            setupResults.push({ table: 'sessions', status: 'exists' });
        }
    } catch (err) {
        console.log('   ❌ Error:', err.message, '\n');
        setupResults.push({ table: 'sessions', status: 'error', error: err.message });
    }

    // 6. Check attendance table
    console.log('6. Checking attendance table...');
    try {
        const { data, error } = await supabase
            .from('attendance')
            .select('id')
            .limit(1);
        
        if (error) {
            console.log('   ❌ Error:', error.message, '\n');
            setupResults.push({ table: 'attendance', status: 'error', error: error.message });
        } else {
            console.log('   ✅ attendance table accessible\n');
            setupResults.push({ table: 'attendance', status: 'exists' });
        }
    } catch (err) {
        console.log('   ❌ Error:', err.message, '\n');
        setupResults.push({ table: 'attendance', status: 'error', error: err.message });
    }

    // 7. Check assignments table
    console.log('7. Checking assignments table...');
    try {
        const { data, error } = await supabase
            .from('assignments')
            .select('id')
            .limit(1);
        
        if (error) {
            console.log('   ❌ Error:', error.message, '\n');
            setupResults.push({ table: 'assignments', status: 'error', error: error.message });
        } else {
            console.log('   ✅ assignments table accessible\n');
            setupResults.push({ table: 'assignments', status: 'exists' });
        }
    } catch (err) {
        console.log('   ❌ Error:', err.message, '\n');
        setupResults.push({ table: 'assignments', status: 'error', error: err.message });
    }

    // 8. Check submissions table
    console.log('8. Checking submissions table...');
    try {
        const { data, error } = await supabase
            .from('submissions')
            .select('id')
            .limit(1);
        
        if (error) {
            console.log('   ❌ Error:', error.message, '\n');
            setupResults.push({ table: 'submissions', status: 'error', error: error.message });
        } else {
            console.log('   ✅ submissions table accessible\n');
            setupResults.push({ table: 'submissions', status: 'exists' });
        }
    } catch (err) {
        console.log('   ❌ Error:', err.message, '\n');
        setupResults.push({ table: 'submissions', status: 'error', error: err.message });
    }

    // Summary
    console.log('========================================');
    console.log('SETUP SUMMARY');
    console.log('========================================');
    setupResults.forEach(result => {
        const icon = result.status === 'exists' ? '✅' : 
                     result.status === 'needs_manual_creation' ? '⚠️' : '❌';
        console.log(`${icon} ${result.table}: ${result.status}`);
    });

    console.log('\n📋 NEXT STEPS:');
    console.log('1. If parent_student table needs creation, run the SQL above in Supabase');
    console.log('2. Ensure all tables have proper RLS policies');
    console.log('3. Create an admin user in the database');
    console.log('4. Start implementing admin routes');
}

setupDatabase().catch(console.error);
