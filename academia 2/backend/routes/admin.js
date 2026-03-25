const express = require('express');
const router = express.Router();
const supabase = require('../utils/db');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

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

// GET ALL USERS
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

        res.json({ users: data, count: data.length });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE USER
router.post('/users', adminMiddleware, async (req, res) => {
    try {
        const { full_name, email, password, role, phone, date_of_birth, parent_of } = req.body;
        
        if (!full_name || !email || !password || !role) {
            return res.status(400).json({ message: 'Full name, email, password, and role are required' });
        }

        if (!['teacher', 'student', 'parent'].includes(role)) {
            return res.status(400).json({ message: 'Role must be teacher, student, or parent' });
        }

        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('email', email);

        if (existing && existing.length > 0) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

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

        if (role === 'parent' && parent_of) {
            await supabase
                .from('parent_student')
                .insert([{ parent_id: userId, student_id: parent_of }]);
        }

        res.status(201).json({
            message: 'User created successfully',
            user: { id: userId, full_name, email, role }
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

        res.json({ message: 'User updated successfully', user: data[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE USER
router.delete('/users/:id', adminMiddleware, async (req, res) => {
    try {
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

// GET ALL COURSES WITH STATS
router.get('/courses', adminMiddleware, async (req, res) => {
    try {
        const { data: courses, error } = await supabase
            .from('courses')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        const teacherIds = [...new Set(courses.map(c => c.teacher_id).filter(Boolean))];
        const courseIds = courses.map(c => c.id);

        let teachersData = [];
        if (teacherIds.length > 0) {
            const { data: teachers } = await supabase
                .from('users')
                .select('id, full_name, email')
                .in('id', teacherIds);
            teachersData = teachers || [];
        }

        let enrollmentsData = [];
        if (courseIds.length > 0) {
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('course_id')
                .in('course_id', courseIds);
            enrollmentsData = enrollments || [];
        }

        const enrollmentCounts = {};
        enrollmentsData.forEach(e => {
            enrollmentCounts[e.course_id] = (enrollmentCounts[e.course_id] || 0) + 1;
        });

        const formattedCourses = courses.map(course => ({
            ...course,
            teacher: teachersData.find(t => t.id === course.teacher_id),
            enrollment_count: enrollmentCounts[course.id] || 0
        }));

        res.json({ courses: formattedCourses, count: courses.length });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET COURSE DETAILS
router.get('/courses/:id', adminMiddleware, async (req, res) => {
    try {
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .eq('id', req.params.id);

        if (courseError || !course || course.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const { data: enrollments, error: enrollError } = await supabase
            .from('enrollments')
            .select('*')
            .eq('course_id', req.params.id);

        if (enrollError) {
            return res.status(500).json({ message: enrollError.message });
        }

        const { data: sessions, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('course_id', req.params.id)
            .order('created_at', { ascending: false });

        if (sessionError) {
            return res.status(500).json({ message: sessionError.message });
        }

        const studentIds = [...new Set(enrollments.map(e => e.student_id))];
        let studentsData = [];
        if (studentIds.length > 0) {
            const { data: students } = await supabase
                .from('users')
                .select('id, full_name, email')
                .in('id', studentIds);
            studentsData = students || [];
        }

        const formattedEnrollments = enrollments.map(e => ({
            ...e,
            student: studentsData.find(s => s.id === e.student_id)
        }));

        const teacherIds = course[0].teacher_id ? [course[0].teacher_id] : [];
        let teachersData = [];
        if (teacherIds.length > 0) {
            const { data: teachers } = await supabase
                .from('users')
                .select('id, full_name, email')
                .in('id', teacherIds);
            teachersData = teachers || [];
        }

        res.json({
            course: { ...course[0], teacher: teachersData.find(t => t.id === course[0].teacher_id) },
            enrollments: formattedEnrollments,
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

// GET ALL ENROLLMENTS - SIMPLIFIED
router.get('/enrollments', adminMiddleware, async (req, res) => {
    try {
        console.log('Admin enrollments request received');
        const { course_id, student_id } = req.query;
        
        let query = supabase
            .from('enrollments')
            .select('*')
            .order('enrolled_at', { ascending: false });

        if (course_id) query = query.eq('course_id', course_id);
        if (student_id) query = query.eq('student_id', student_id);

        const { data: enrollments, error } = await query;
        
        console.log('Enrollments data:', enrollments ? enrollments.length : 0);
        console.log('Error:', error);
        
        if (error) {
            console.error('Supabase enrollments error:', error);
            return res.status(500).json({ message: error.message });
        }
        
// Manual course + student lookup
        const courseIds = enrollments?.map(e => e.course_id) || [];
        const studentIds = enrollments?.map(e => e.student_id) || [];
        
        let courses = [], students = [];
        
        if (courseIds.length > 0) {
            const { data: courseData, error: courseError } = await supabase
                .from('courses')
                .select('id, title, teacher_id')
                .in('id', courseIds);
            if (!courseError) courses = courseData || [];
        }
        
        if (studentIds.length > 0) {
            const { data: studentData, error: studentError } = await supabase
                .from('users')
                .select('id, full_name, email')
                .in('id', studentIds);
            if (!studentError) students = studentData || [];
        }
        
        const courseMap = {};
        courses.forEach(c => courseMap[c.id] = c);
        const studentMap = {};
        students.forEach(s => studentMap[s.id] = s);
        
        const formattedEnrollments = enrollments.map(e => ({
            ...e,
            course: courseMap[e.course_id] || null,
            student: studentMap[e.student_id] || null
        }));

        if (error) {
            console.error('Supabase enrollments error:', error);
            return res.status(500).json({ message: error.message, details: error });
        }

        res.json({ 
            enrollments: formattedEnrollments, 
            count: formattedEnrollments.length 
        });

    } catch (err) {
        console.error('Full enrollments endpoint error:', err);
        res.status(500).json({ message: err.message, stack: err.stack });
    }
});

// MANUALLY ENROLL STUDENT
router.post('/enrollments', adminMiddleware, async (req, res) => {
    try {
        const { student_id, course_id } = req.body;

        if (!student_id || !course_id) {
            return res.status(400).json({ message: 'Student ID and Course ID are required' });
        }

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

// GET ATTENDANCE BY SESSION
router.get('/attendance/session/:sessionId', adminMiddleware, async (req, res) => {
    try {
        const { data: attendance, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('session_id', req.params.sessionId)
            .order('marked_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        const studentIds = [...new Set(attendance.map(a => a.student_id))];
        let studentsData = [];
        if (studentIds.length > 0) {
            const { data: students } = await supabase
                .from('users')
                .select('id, full_name, email')
                .in('id', studentIds);
            studentsData = students || [];
        }

        const sessionIds = [...new Set(attendance.map(a => a.session_id))];
        let sessionsData = [];
        if (sessionIds.length > 0) {
            const { data: sessions } = await supabase
                .from('sessions')
                .select('*')
                .in('id', sessionIds);
            sessionsData = sessions || [];
        }

        const formattedAttendance = attendance.map(a => ({
            ...a,
            student: studentsData.find(s => s.id === a.student_id),
            session: sessionsData.find(s => s.id === a.session_id)
        }));

        res.json({ attendance: formattedAttendance, count: formattedAttendance.length });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET ATTENDANCE BY COURSE
router.get('/attendance/course/:courseId', adminMiddleware, async (req, res) => {
    try {
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

        const { data: attendance, error } = await supabase
            .from('attendance')
            .select('*')
            .in('session_id', sessionIds)
            .order('marked_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        const studentIds = [...new Set(attendance.map(a => a.student_id))];
        let studentsData = [];
        if (studentIds.length > 0) {
            const { data: students } = await supabase
                .from('users')
                .select('id, full_name, email')
                .in('id', studentIds);
            studentsData = students || [];
        }

        const formattedAttendance = attendance.map(a => ({
            ...a,
            student: studentsData.find(s => s.id === a.student_id)
        }));

        res.json({ attendance: formattedAttendance, count: formattedAttendance.length });

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
            .select('*')
            .eq('student_id', req.params.studentId)
            .order('marked_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ attendance: attendance || [], count: attendance?.length || 0 });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET SYSTEM STATS
router.get('/stats', adminMiddleware, async (req, res) => {
    try {
        const { data: userCounts, error: userError } = await supabase
            .from('users')
            .select('role', { count: 'exact' });

        if (userError) throw userError;

        const counts = { total_users: 0, teachers: 0, students: 0, parents: 0, admins: 0 };
        userCounts.forEach(u => {
            counts.total_users++;
            if (u.role === 'teacher') counts.teachers++;
            if (u.role === 'student') counts.students++;
            if (u.role === 'parent') counts.parents++;
            if (u.role === 'admin') counts.admins++;
        });

        const { count: totalCourses } = await supabase
            .from('courses')
            .select('*', { count: 'exact', head: true });

        const { count: totalEnrollments } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true });

        const { count: totalSessions } = await supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true });

        const { count: totalAttendance } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true });

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

        // Get recent enrollments
        const { data: recentEnrollments } = await supabase
            .from('enrollments')
            .select('*')
            .order('enrolled_at', { ascending: false })
            .limit(limit);

        // Get recent attendance
        const { data: recentAttendance } = await supabase
            .from('attendance')
            .select('*')
            .order('marked_at', { ascending: false })
            .limit(limit);

        // Get recent sessions
        const { data: recentSessions } = await supabase
            .from('sessions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        // Fetch related data for enrollments
        const enrollmentStudentIds = [...new Set((recentEnrollments || []).map(e => e.student_id))];
        const enrollmentCourseIds = [...new Set((recentEnrollments || []).map(e => e.course_id))];
        
        let enrollmentStudents = [];
        let enrollmentCourses = [];
        
        if (enrollmentStudentIds.length > 0) {
            const { data: students } = await supabase
                .from('users')
                .select('id, full_name')
                .in('id', enrollmentStudentIds);
            enrollmentStudents = students || [];
        }
        
        if (enrollmentCourseIds.length > 0) {
            const { data: courses } = await supabase
                .from('courses')
                .select('id, title')
                .in('id', enrollmentCourseIds);
            enrollmentCourses = courses || [];
        }

        // Create maps
        const studentMap = {};
        enrollmentStudents.forEach(s => { studentMap[s.id] = s; });
        const courseMap = {};
        enrollmentCourses.forEach(c => { courseMap[c.id] = c; });

        // Add student and course info to enrollments
        const enrichedEnrollments = (recentEnrollments || []).map(e => ({
            ...e,
            student: studentMap[e.student_id] || null,
            course: courseMap[e.course_id] || null
        }));

        // Fetch related data for attendance
        const attendanceStudentIds = [...new Set((recentAttendance || []).map(a => a.student_id))];
        const attendanceSessionIds = [...new Set((recentAttendance || []).map(a => a.session_id))];
        
        let attendanceStudents = [];
        let attendanceSessions = [];
        
        if (attendanceStudentIds.length > 0) {
            const { data: students } = await supabase
                .from('users')
                .select('id, full_name')
                .in('id', attendanceStudentIds);
            attendanceStudents = students || [];
        }
        
        if (attendanceSessionIds.length > 0) {
            const { data: sessions } = await supabase
                .from('sessions')
                .select('*')
                .in('id', attendanceSessionIds);
            attendanceSessions = sessions || [];
        }

        // Get course IDs from sessions
        const attendanceCourseIds = [...new Set(attendanceSessions.map(s => s.course_id).filter(Boolean))];
        let attendanceCourses = [];
        
        if (attendanceCourseIds.length > 0) {
            const { data: courses } = await supabase
                .from('courses')
                .select('id, title')
                .in('id', attendanceCourseIds);
            attendanceCourses = courses || [];
        }

        // Create maps
        const attStudentMap = {};
        attendanceStudents.forEach(s => { attStudentMap[s.id] = s; });
        const attSessionMap = {};
        attendanceSessions.forEach(s => { attSessionMap[s.id] = s; });
        const attCourseMap = {};
        attendanceCourses.forEach(c => { attCourseMap[c.id] = c; });

        // Add student and session info to attendance
        const enrichedAttendance = (recentAttendance || []).map(a => {
            const session = attSessionMap[a.session_id];
            const course = session ? attCourseMap[session.course_id] : null;
            return {
                ...a,
                student: attStudentMap[a.student_id] || null,
                session: session ? { ...session, course: course ? { title: course.title } : null } : null
            };
        });

        // Fetch related data for sessions
        const sessionCourseIds = [...new Set((recentSessions || []).map(s => s.course_id).filter(Boolean))];
        const sessionTeacherIds = [...new Set((recentSessions || []).map(s => s.teacher_id).filter(Boolean))];
        
        let sessionCourses = [];
        let sessionTeachers = [];
        
        if (sessionCourseIds.length > 0) {
            const { data: courses } = await supabase
                .from('courses')
                .select('id, title')
                .in('id', sessionCourseIds);
            sessionCourses = courses || [];
        }
        
        if (sessionTeacherIds.length > 0) {
            const { data: teachers } = await supabase
                .from('users')
                .select('id, full_name')
                .in('id', sessionTeacherIds);
            sessionTeachers = teachers || [];
        }

        // Create maps
        const sessCourseMap = {};
        sessionCourses.forEach(c => { sessCourseMap[c.id] = c; });
        const sessTeacherMap = {};
        sessionTeachers.forEach(t => { sessTeacherMap[t.id] = t; });

        // Add course and teacher info to sessions
        const enrichedSessions = (recentSessions || []).map(s => ({
            ...s,
            course: sessCourseMap[s.course_id] || null,
            teacher: sessTeacherMap[s.teacher_id] || null
        }));

        res.json({
            recent_enrollments: enrichedEnrollments,
            recent_attendance: enrichedAttendance,
            recent_sessions: enrichedSessions
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
