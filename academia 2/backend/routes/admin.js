const express = require('express');
const router = express.Router();
const supabase = require('../utils/db');
const bcrypt = require('bcrypt');

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// ============================================
// ADMIN MIDDLEWARE
// ============================================

const adminMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.id);

        if (error || !user || user.length === 0) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        if (user[0].role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }

        req.user = user[0];
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// ============================================
// 1. USER MANAGEMENT (Admin Only)
// ============================================

// GET ALL USERS (with role filter)
router.get('/users', adminMiddleware, async (req, res) => {
    try {
        const { role, status, search } = req.query;
        
        let query = supabase
            .from('users')
            .select('id, full_name, email, role, status, created_at, phone, date_of_birth')
            .order('created_at', { ascending: false });

        if (role) query = query.eq('role', role);
        if (status) query = query.eq('status', status);
        if (search) {
            query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ 
            users: data,
            count: data.length
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE USER (Teacher, Student, or Parent)
router.post('/users', adminMiddleware, async (req, res) => {
    try {
        const { full_name, email, password, role, phone, date_of_birth, parent_of } = req.body;
        
        if (!full_name || !email || !password || !role) {
            return res.status(400).json({ message: 'Full name, email, password, and role are required' });
        }

        if (!['teacher', 'student', 'parent'].includes(role)) {
            return res.status(400).json({ message: 'Role must be teacher, student, or parent' });
        }

        // Check if email exists
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', email);

        if (existing && existing.length > 0) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const { data: user, error } = await supabase
            .from('users')
            .insert([{
                full_name,
                email,
                password: hashedPassword,
                role,
                phone,
                date_of_birth,
                status: 'active'
            }])
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        const userId = user[0].id;

        // If creating a parent and parent_of is provided, link to student
        if (role === 'parent' && parent_of) {
            const { error: linkError } = await supabase
                .from('parent_student')
                .insert([{
                    parent_id: userId,
                    student_id: parent_of
                }]);

            if (linkError) {
                console.error('Error linking parent to student:', linkError);
            }
        }

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: userId,
                full_name,
                email,
                role
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// UPDATE USER
router.patch('/users/:id', adminMiddleware, async (req, res) => {
    try {
        const { full_name, email, role, status, phone, date_of_birth } = req.body;
        
        const updates = {};
        if (full_name) updates.full_name = full_name;
        if (email) updates.email = email;
        if (role) updates.role = role;
        if (status) updates.status = status;
        if (phone) updates.phone = phone;
        if (date_of_birth) updates.date_of_birth = date_of_birth;

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', req.params.id)
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'User updated successfully',
            user: data[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE USER
router.delete('/users/:id', adminMiddleware, async (req, res) => {
    try {
        // Prevent deleting self
        if (req.params.id === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete your own account' });
        }

        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ message: 'User deleted successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// 2. COURSE MANAGEMENT (Admin View)
// ============================================

// GET ALL COURSES WITH STATS
router.get('/courses', adminMiddleware, async (req, res) => {
    try {
        const { data: courses, error } = await supabase
            .from('courses')
            .select(`
                *,
                teacher:users(id, full_name, email),
                enrollments:enrollments(count)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        // Format response with enrollment counts
        const formattedCourses = courses.map(course => ({
            ...course,
            enrollment_count: course.enrollments?.[0]?.count || 0
        }));

        res.json({ 
            courses: formattedCourses,
            count: courses.length
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET COURSE DETAILS WITH ENROLLED STUDENTS
router.get('/courses/:id', adminMiddleware, async (req, res) => {
    try {
        // Get course details
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select(`
                *,
                teacher:users(id, full_name, email)
            `)
            .eq('id', req.params.id);

        if (courseError || !course || course.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Get enrolled students
        const { data: enrollments, error: enrollError } = await supabase
            .from('enrollments')
            .select(`
                *,
                student:users(id, full_name, email)
            `)
            .eq('course_id', req.params.id);

        if (enrollError) {
            return res.status(500).json({ message: enrollError.message });
        }

        // Get sessions
        const { data: sessions, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('course_id', req.params.id)
            .order('created_at', { ascending: false });

        if (sessionError) {
            return res.status(500).json({ message: sessionError.message });
        }

        res.json({
            course: course[0],
            enrollments: enrollments || [],
            sessions: sessions || [],
            stats: {
                total_students: enrollments?.length || 0,
                total_sessions: sessions?.length || 0
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE COURSE
router.delete('/courses/:id', adminMiddleware, async (req, res) => {
    try {
        const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ message: 'Course deleted successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// 3. ENROLLMENT MANAGEMENT
// ============================================

// GET ALL ENROLLMENTS
router.get('/enrollments', adminMiddleware, async (req, res) => {
    try {
        const { course_id, student_id } = req.query;
        
        // First get enrollments
        let enrollmentsQuery = supabase
            .from('enrollments')
            .select('*')
            .order('enrolled_at', { ascending: false });

        if (course_id) enrollmentsQuery = enrollmentsQuery.eq('course_id', course_id);
        if (student_id) enrollmentsQuery = enrollmentsQuery.eq('student_id', student_id);

        const { data: enrollments, error: enrollError } = await enrollmentsQuery;

        if (enrollError) {
            return res.status(500).json({ message: enrollError.message });
        }

        // Get all unique student IDs and course IDs
        const studentIds = [...new Set(enrollments.map(e => e.student_id))];
        const courseIds = [...new Set(enrollments.map(e => e.course_id))];

        // Fetch students
        let studentsData = [];
        if (studentIds.length > 0) {
            const { data: students } = await supabase
                .from('users')
                .select('id, full_name, email')
                .in('id', studentIds);
            studentsData = students || [];
        }

        // Fetch courses
        let coursesData = [];
        if (courseIds.length > 0) {
            const { data: courses } = await supabase
                .from('courses')
                .select('id, title, teacher_id')
                .in('id', courseIds);
            coursesData = courses || [];
        }

        // Map student and course data to enrollments
        const formattedEnrollments = enrollments.map(e => ({
            ...e,
            student: studentsData.find(s => s.id === e.student_id),
            course: coursesData.find(c => c.id === e.course_id)
        }));

        res.json({ 
            enrollments: formattedEnrollments,
            count: formattedEnrollments.length
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// MANUALLY ENROLL STUDENT
router.post('/enrollments', adminMiddleware, async (req, res) => {
    try {
        const { student_id, course_id } = req.body;

        if (!student_id || !course_id) {
            return res.status(400).json({ message: 'Student ID and Course ID are required' });
        }

        // Check if already enrolled
        const { data: existing } = await supabase
            .from('enrollments')
            .select('id')
            .eq('student_id', student_id)
            .eq('course_id', course_id);

        if (existing && existing.length > 0) {
            return res.status(400).json({ message: 'Student already enrolled in this course' });
        }

        const { data, error } = await supabase
            .from('enrollments')
            .insert([{
                student_id,
                course_id,
                enrolled_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.status(201).json({
            message: 'Student enrolled successfully',
            enrollment: data[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// REMOVE ENROLLMENT
router.delete('/enrollments/:id', adminMiddleware, async (req, res) => {
    try {
        const { error } = await supabase
            .from('enrollments')
            .delete()
            .eq('id', req.params.id);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ message: 'Enrollment removed successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// 4. ATTENDANCE REPORTS
// ============================================

// GET ATTENDANCE BY SESSION
router.get('/attendance/session/:sessionId', adminMiddleware, async (req, res) => {
    try {
        const { data: attendance, error } = await supabase
            .from('attendance')
            .select(`
                *,
                student:users(id, full_name, email),
                session:sessions(*, course:courses(title))
            `)
            .eq('session_id', req.params.sessionId)
            .order('marked_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({
            attendance: attendance || [],
            count: attendance?.length || 0
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET ATTENDANCE BY COURSE
router.get('/attendance/course/:courseId', adminMiddleware, async (req, res) => {
    try {
        // Get all sessions for this course
        const { data: sessions, error: sessionError } = await supabase
            .from('sessions')
            .select('id')
            .eq('course_id', req.params.courseId);

        if (sessionError) {
            return res.status(500).json({ message: sessionError.message });
        }

        const sessionIds = sessions.map(s => s.id);

        if (sessionIds.length === 0) {
            return res.json({ attendance: [], count: 0 });
        }

        // Get attendance for all sessions
        const { data: attendance, error } = await supabase
            .from('attendance')
            .select(`
                *,
                student:users(id, full_name, email),
                session:sessions(id, date, status)
            `)
            .in('session_id', sessionIds)
            .order('marked_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({
            attendance: attendance || [],
            count: attendance?.length || 0
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET ATTENDANCE BY STUDENT
router.get('/attendance/student/:studentId', adminMiddleware, async (req, res) => {
    try {
        const { data: attendance, error } = await supabase
            .from('attendance')
            .select(`
                *,
                session:sessions(*, course:courses(title))
            `)
            .eq('student_id', req.params.studentId)
            .order('marked_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({
            attendance: attendance || [],
            count: attendance?.length || 0
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ============================================
// 5. DASHBOARD STATISTICS
// ============================================

// GET SYSTEM OVERVIEW STATS
router.get('/stats', adminMiddleware, async (req, res) => {
    try {
        // Count users by role
        const { data: userCounts, error: userError } = await supabase
            .from('users')
            .select('role', { count: 'exact' });

        if (userError) throw userError;

        const counts = {
            total_users: 0,
            teachers: 0,
            students: 0,
            parents: 0,
            admins: 0
        };

        userCounts.forEach(u => {
            counts.total_users++;
            if (u.role === 'teacher') counts.teachers++;
            if (u.role === 'student') counts.students++;
            if (u.role === 'parent') counts.parents++;
            if (u.role === 'admin') counts.admins++;
        });

        // Count courses
        const { count: totalCourses, error: courseError } = await supabase
            .from('courses')
            .select('*', { count: 'exact', head: true });

        if (courseError) throw courseError;

        // Count enrollments
        const { count: totalEnrollments, error: enrollError } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true });

        if (enrollError) throw enrollError;

        // Count sessions
        const { count: totalSessions, error: sessionError } = await supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true });

        if (sessionError) throw sessionError;

        // Count attendance records
        const { count: totalAttendance, error: attendError } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true });

        if (attendError) throw attendError;

        res.json({
            users: counts,
            courses: totalCourses || 0,
            enrollments: totalEnrollments || 0,
            sessions: totalSessions || 0,
            attendance_records: totalAttendance || 0
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET RECENT ACTIVITY
router.get('/activity', adminMiddleware, async (req, res) => {
    try {
        const limit = req.query.limit || 20;

        // Recent enrollments
        const { data: recentEnrollments, error: enrollError } = await supabase
            .from('enrollments')
            .select(`
                *,
                student:users(id, full_name),
                course:courses(id, title)
            `)
            .order('enrolled_at', { ascending: false })
            .limit(limit);

        if (enrollError) throw enrollError;

        // Recent attendance
        const { data: recentAttendance, error: attendError } = await supabase
            .from('attendance')
            .select(`
                *,
                student:users(id, full_name),
                session:sessions(id, course:courses(title))
            `)
            .order('marked_at', { ascending: false })
            .limit(limit);

        if (attendError) throw attendError;

        // Recent sessions
        const { data: recentSessions, error: sessionError } = await supabase
            .from('sessions')
            .select(`
                *,
                course:courses(id, title),
                teacher:users(id, full_name)
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (sessionError) throw sessionError;

        res.json({
            recent_enrollments: recentEnrollments || [],
            recent_attendance: recentAttendance || [],
            recent_sessions: recentSessions || []
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
