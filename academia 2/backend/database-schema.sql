-- ACADEMIA LMS - Complete Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. ASSIGNMENTS TABLE
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

-- Policies for assignments
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
-- 2. SUBMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT NOW(),
    grade NUMERIC(5,2),
    feedback TEXT,
    status TEXT DEFAULT 'submitted', -- submitted, graded, returned
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(assignment_id, student_id)
);

-- Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Policies for submissions
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
-- 3. UPDATE EXISTING TABLES (if needed)
-- ============================================

-- Ensure users table has all required fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Ensure courses table has all fields
ALTER TABLE courses ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 50;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Ensure sessions table has all fields
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
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

-- ============================================
-- 5. FUNCTIONS AND TRIGGERS
-- ============================================

-- Update updated_at timestamp
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

-- ============================================
-- 6. VIEWS FOR REPORTS
-- ============================================

-- Course enrollment count view
CREATE OR REPLACE VIEW course_enrollment_stats AS
SELECT 
    c.id as course_id,
    c.title,
    c.teacher_id,
    COUNT(e.id) as enrolled_students,
    c.max_students,
    (COUNT(e.id)::FLOAT / c.max_students * 100) as fill_percentage
FROM courses c
LEFT JOIN enrollments e ON c.id = e.course_id
GROUP BY c.id, c.title, c.teacher_id, c.max_students;

-- Student attendance summary view
CREATE OR REPLACE VIEW student_attendance_summary AS
SELECT 
    s.id as student_id,
    s.full_name as student_name,
    c.id as course_id,
    c.title as course_name,
    COUNT(DISTINCT ses.id) as total_sessions,
    COUNT(DISTINCT a.id) as attended_sessions,
    CASE 
        WHEN COUNT(DISTINCT ses.id) > 0 
        THEN ROUND(COUNT(DISTINCT a.id)::NUMERIC / COUNT(DISTINCT ses.id) * 100, 2)
        ELSE 0 
    END as attendance_percentage
FROM users s
JOIN enrollments e ON s.id = e.student_id
JOIN courses c ON e.course_id = c.id
LEFT JOIN sessions ses ON c.id = ses.course_id AND ses.status = 'ended'
LEFT JOIN attendance a ON ses.id = a.session_id AND a.student_id = s.id
WHERE s.role = 'student'
GROUP BY s.id, s.full_name, c.id, c.title;

-- ============================================
-- 7. ADMIN USER SETUP (Optional)
-- ============================================

-- To create an admin user, run:
/*
INSERT INTO users (full_name, email, password, role, status)
VALUES (
    'System Admin', 
    'admin@academia.edu', 
    '$2b$10$YourHashedPasswordHere',  -- Use bcrypt hash
    'admin',
    'active'
);
*/

-- ============================================
-- SETUP COMPLETE
-- ============================================

SELECT 'Database schema setup complete!' as status;
