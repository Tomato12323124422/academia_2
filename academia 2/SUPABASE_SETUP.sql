-- ============================================
-- ACADEMIA LMS - COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. USERS TABLE (Should already exist, but verify)
-- ============================================

-- If users table doesn't exist, create it:
/*
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'parent')),
    phone TEXT,
    address TEXT,
    date_of_birth DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Admins can manage all users"
    ON users FOR ALL
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );
*/

-- ============================================
-- 2. PARENT-STUDENT LINK TABLE
-- ============================================

-- Add relationship column if table already exists
ALTER TABLE parent_student ADD COLUMN IF NOT EXISTS relationship TEXT DEFAULT 'Child';

CREATE TABLE IF NOT EXISTS parent_student (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    relationship TEXT DEFAULT 'Child',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(parent_id, student_id)
);



-- Enable RLS
ALTER TABLE parent_student ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Parents can view their children"
    ON parent_student FOR SELECT
    USING (parent_id = auth.uid());

CREATE POLICY "Students can view their parents"
    ON parent_student FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Admins can manage parent-student links"
    ON parent_student FOR ALL
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- 3. COURSES TABLE (Should exist, verify columns)
-- ============================================

-- Add missing columns if table exists:
ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 50;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_code TEXT UNIQUE;

-- If courses table doesn't exist:
/*
CREATE TABLE IF NOT EXISTS courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_code TEXT UNIQUE,
    max_students INTEGER DEFAULT 50,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active courses"
    ON courses FOR SELECT
    USING (status = 'active');

CREATE POLICY "Teachers can manage their courses"
    ON courses FOR ALL
    USING (teacher_id = auth.uid());

CREATE POLICY "Admins can manage all courses"
    ON courses FOR ALL
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );
*/

-- ============================================
-- 4. ENROLLMENTS TABLE (Should exist)
-- ============================================

-- If doesn't exist:
/*
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, course_id)
);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own enrollments"
    ON enrollments FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "Teachers can view course enrollments"
    ON enrollments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM courses 
            WHERE id = course_id AND teacher_id = auth.uid()
        )
    );
*/

-- ============================================
-- 5. SESSIONS TABLE (Should exist, add columns)
-- ============================================

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- If doesn't exist:
/*
CREATE TABLE IF NOT EXISTS sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date TIMESTAMP DEFAULT NOW(),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
    topic TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
*/

-- ============================================
-- 6. ATTENDANCE TABLE (Should exist)
-- ============================================

-- If doesn't exist:
/*
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    marked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, session_id)
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
*/

-- ============================================
-- 7. ASSIGNMENTS TABLE (NEW - MUST CREATE)
-- ============================================

CREATE TABLE IF NOT EXISTS assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    due_date TIMESTAMP,
    max_points INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Teachers can manage their course assignments"
    ON assignments FOR ALL
    USING (
        teacher_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM courses 
            WHERE id = course_id AND teacher_id = auth.uid()
        )
    );

CREATE POLICY "Students can view assignments for enrolled courses"
    ON assignments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM enrollments 
            WHERE course_id = assignments.course_id 
            AND student_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all assignments"
    ON assignments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- 8. SUBMISSIONS TABLE (NEW - MUST CREATE)
-- ============================================

CREATE TABLE IF NOT EXISTS submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),
    grade NUMERIC(5,2),
    feedback TEXT,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

-- Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Students can manage their own submissions"
    ON submissions FOR ALL
    USING (student_id = auth.uid());

CREATE POLICY "Teachers can view and grade submissions for their courses"
    ON submissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM assignments a
            JOIN courses c ON a.course_id = c.id
            WHERE a.id = submissions.assignment_id
            AND c.teacher_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all submissions"
    ON submissions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ============================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_parent ON parent_student(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_student ON parent_student(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id);

-- ============================================
-- 10. FUNCTIONS AND TRIGGERS
-- ============================================

-- Update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to assignments
DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to submissions
DROP TRIGGER IF EXISTS update_submissions_updated_at ON submissions;
CREATE TRIGGER update_submissions_updated_at
    BEFORE UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to courses
DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 11. SAMPLE DATA (Optional - for testing)
-- ============================================

-- Create Admin User (password: admin123)
-- Note: Use bcrypt hash in production
/*
INSERT INTO users (full_name, email, password, role, status)
VALUES (
    'System Administrator',
    'admin@academia.edu',
    '$2b$10$YourHashedPasswordHere',  -- Replace with bcrypt hash
    'admin',
    'active'
);
*/

-- Create Sample Teacher
/*
INSERT INTO users (full_name, email, password, role, status)
VALUES (
    'John Smith',
    'teacher@academia.edu',
    '$2b$10$YourHashedPasswordHere',
    'teacher',
    'active'
);
*/

-- Create Sample Student
/*
INSERT INTO users (full_name, email, password, role, status)
VALUES (
    'Jane Doe',
    'student@academia.edu',
    '$2b$10$YourHashedPasswordHere',
    'student',
    'active'
);
*/

-- Create Sample Parent
/*
INSERT INTO users (full_name, email, password, role, status)
VALUES (
    'Robert Doe',
    'parent@academia.edu',
    '$2b$10$YourHashedPasswordHere',
    'parent',
    'active'
);
*/

-- Link Parent to Student
/*
INSERT INTO parent_student (parent_id, student_id, relationship)
VALUES (
    (SELECT id FROM users WHERE email = 'parent@academia.edu'),
    (SELECT id FROM users WHERE email = 'student@academia.edu'),
    'Child'
);
*/


-- Create Sample Course
/*
INSERT INTO courses (title, description, teacher_id, course_code, max_students, status)
VALUES (
    'Introduction to Computer Science',
    'Learn the fundamentals of computer science and programming',
    (SELECT id FROM users WHERE email = 'teacher@academia.edu'),
    'CS101',
    50,
    'active'
);
*/

-- Enroll Student in Course
/*
INSERT INTO enrollments (student_id, course_id, enrolled_at)
VALUES (
    (SELECT id FROM users WHERE email = 'student@academia.edu'),
    (SELECT id FROM courses WHERE course_code = 'CS101'),
    NOW()
);
*/

-- ============================================
-- SETUP COMPLETE
-- ============================================

SELECT 'Database setup complete! Tables created:' as status;
