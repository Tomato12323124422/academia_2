const express = require('express');
const router = express.Router();
const supabase = require('../utils/db');

// Middleware to verify JWT token
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
        
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.id);

        if (error || !user || user.length === 0) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        req.user = user[0];
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// GET CHILDREN LINKED TO GUARDIAN
router.get('/children', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: 'Only parents can access this' });
        }

        // Get linked children - use simple query without join
        const { data: links, error } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        if (!links || links.length === 0) {
            return res.json({ children: [] });
        }

        // Get student IDs to fetch
        const studentIds = links.map(link => link.student_id);
        
        // Fetch student details separately
        const { data: students, studentError } = await supabase
            .from('users')
            .select('id, full_name, email, role')
            .in('id', studentIds);

        if (studentError) {
            console.error('Error fetching students:', studentError);
            return res.status(500).json({ message: studentError.message });
        }

        // Create a map for quick lookup
        const studentMap = {};
        if (students) {
            students.forEach(student => {
                studentMap[student.id] = student;
            });
        }

        // Combine the data
        const children = links.map(link => {
            const student = studentMap[link.student_id];
            return {
                id: student?.id || link.student_id,
                full_name: student?.full_name || 'Unknown',
                email: student?.email || 'Unknown',
                relationship: link.relationship
            };
        });

        res.json({ children });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// SEARCH STUDENT BY EMAIL (for preview before linking)
router.get('/search-student-by-email', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: 'Only parents can search for students' });
        }

        const email = req.query.email;

        if (!email || email.length < 2) {
            return res.status(400).json({ message: 'Please enter at least 2 characters' });
        }

        // Search student by email (case insensitive)
        const { data: student, error } = await supabase
            .from('users')
            .select('id, full_name, email, role')
            .ilike('email', `%${email}%`)
            .eq('role', 'student')
            .limit(10);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        if (!student || student.length === 0) {
            return res.status(404).json({ message: 'No student found with this email' });
        }

        // Check if already linked for each student
        const studentsWithLinkStatus = await Promise.all(student.map(async (s) => {
            const { data: existingLink } = await supabase
                .from('parent_student')
                .select('*')
                .eq('parent_id', req.user.id)
                .eq('student_id', s.id)
                .single();

            return {
                id: s.id,
                full_name: s.full_name,
                email: s.email,
                alreadyLinked: !!existingLink
            };
        }));

        res.json({ students: studentsWithLinkStatus });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// LINK CHILD BY EMAIL
router.post('/link-by-email', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: 'Only parents can link to students' });
        }

        const { email, relationship } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Student email is required' });
        }

        // Find student by email
        const { data: student, studentError } = await supabase
            .from('users')
            .select('id, full_name, email, role')
            .eq('email', email.toLowerCase())
            .eq('role', 'student')
            .single();

        if (studentError || !student) {
            return res.status(404).json({ message: 'Student not found with this email' });
        }

        // Check if already linked
        const { data: existingLink } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', student.id)
            .single();

        if (existingLink) {
            return res.status(400).json({ message: 'This student is already linked to your account' });
        }

        // Create the link
        const { data: link, error } = await supabase
            .from('parent_student')
            .insert([{
                parent_id: req.user.id,
                student_id: student.id,
                relationship: relationship || 'Child'
            }])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({
            message: 'Student linked successfully!',
            child: {
                id: student.id,
                full_name: student.full_name,
                email: student.email,
                relationship: relationship || 'Child'
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET CHILD'S ENROLLED COURSES
router.get('/child/:childId/courses', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: 'Only parents can access this' });
        }

        // Verify parent is linked to this child
        const { data: link } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', req.params.childId)
            .single();

        if (!link) {
            return res.status(403).json({ message: 'Not authorized to view this student\'s courses' });
        }

        // Get enrolled courses with simple queries
        const { data: enrollments, error } = await supabase
            .from('enrollments')
            .select('*')
            .eq('student_id', req.params.childId);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        if (!enrollments || enrollments.length === 0) {
            return res.json({ courses: [] });
        }

        // Get course IDs
        const courseIds = enrollments.map(e => e.course_id);
        
        // Fetch courses
        const { data: courses, courseError } = await supabase
            .from('courses')
            .select('*')
            .in('id', courseIds);

        if (courseError) {
            return res.status(500).json({ message: courseError.message });
        }

        // Fetch teachers
        const teacherIds = courses.map(c => c.teacher_id).filter(id => id);
        let teachers = [];
        if (teacherIds.length > 0) {
            const { data: teacherData } = await supabase
                .from('users')
                .select('id, full_name')
                .in('id', teacherIds);
            teachers = teacherData || [];
        }

        // Create maps
        const courseMap = {};
        courses.forEach(c => { courseMap[c.id] = c; });
        const teacherMap = {};
        teachers.forEach(t => { teacherMap[t.id] = t; });

        // Combine data
        const coursesWithDetails = enrollments.map(e => {
            const course = courseMap[e.course_id];
            const teacher = course ? teacherMap[course.teacher_id] : null;
            return {
                id: course?.id,
                title: course?.title || 'Unknown',
                description: course?.description,
                category: course?.category,
                duration: course?.duration,
                teacher: teacher?.full_name || 'Unknown',
                enrolled_at: e.enrolled_at
            };
        });

        res.json({ courses: coursesWithDetails });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET CHILD'S GRADES
router.get('/child/:childId/grades', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: 'Only parents can access this' });
        }

        // Verify parent is linked to this child
        const { data: link } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', req.params.childId)
            .single();

        if (!link) {
            return res.status(403).json({ message: 'Not authorized to view this student\'s grades' });
        }

        // Get student's submissions with grades
        const { data: submissions, error } = await supabase
            .from('submissions')
            .select('*')
            .eq('student_id', req.params.childId)
            .not('grade', 'is', null)
            .order('graded_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        if (!submissions || submissions.length === 0) {
            return res.json({ grades: [], overall: { total_points: 0, earned_points: 0, percentage: 0, letter_grade: 'N/A' } });
        }

        // Get assignment IDs
        const assignmentIds = submissions.map(s => s.assignment_id);
        
        // Fetch assignments
        const { data: assignments, assignError } = await supabase
            .from('assignments')
            .select('*')
            .in('id', assignmentIds);

        if (assignError) {
            return res.status(500).json({ message: assignError.message });
        }

        // Get course IDs
        const courseIds = assignments.map(a => a.course_id).filter(id => id);
        
        // Fetch courses
        let courses = [];
        if (courseIds.length > 0) {
            const { data: courseData } = await supabase
                .from('courses')
                .select('id, title')
                .in('id', courseIds);
            courses = courseData || [];
        }

        // Create maps
        const assignmentMap = {};
        assignments.forEach(a => { assignmentMap[a.id] = a; });
        const courseMap = {};
        courses.forEach(c => { courseMap[c.id] = c; });

        // Calculate grades
        let totalPoints = 0;
        let earnedPoints = 0;
        
        const gradesWithCourse = submissions.map(submission => {
            const assignment = assignmentMap[submission.assignment_id];
            const course = assignment ? courseMap[assignment.course_id] : null;
            const points = assignment?.points || 100;
            const earned = submission.grade || 0;
            totalPoints += points;
            earnedPoints += earned;
            
            return {
                id: submission.id,
                assignment_title: assignment?.title || 'Unknown',
                course_name: course?.title || 'Unknown',
                points: points,
                grade: earned,
                percentage: Math.round((earned / points) * 100),
                feedback: submission.feedback,
                submitted_at: submission.submitted_at,
                graded_at: submission.graded_at
            };
        });

        const overallGrade = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

        res.json({ 
            grades: gradesWithCourse,
            overall: {
                total_points: totalPoints,
                earned_points: earnedPoints,
                percentage: overallGrade,
                letter_grade: getLetterGrade(overallGrade)
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET CHILD'S ATTENDANCE
router.get('/child/:childId/attendance', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: 'Only parents can access this' });
        }

        // Verify parent is linked to this child
        const { data: link } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', req.params.childId)
            .single();

        if (!link) {
            return res.status(403).json({ message: 'Not authorized to view this student\'s attendance' });
        }

        // Get student's attendance records
        const { data: attendance, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('student_id', req.params.childId)
            .order('marked_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        // Get session IDs
        const sessionIds = attendance.map(a => a.session_id).filter(id => id);
        
        // Fetch sessions
        let sessions = [];
        if (sessionIds.length > 0) {
            const { data: sessionData } = await supabase
                .from('sessions')
                .select('*')
                .in('id', sessionIds);
            sessions = sessionData || [];
        }

        // Get course IDs
        const courseIds = sessions.map(s => s.course_id).filter(id => id);
        
        // Fetch courses
        let courses = [];
        if (courseIds.length > 0) {
            const { data: courseData } = await supabase
                .from('courses')
                .select('id, title')
                .in('id', courseIds);
            courses = courseData || [];
        }

        // Create maps
        const sessionMap = {};
        sessions.forEach(s => { sessionMap[s.id] = s; });
        const courseMap = {};
        courses.forEach(c => { courseMap[c.id] = c; });

        // Add session and course info to attendance
        const attendanceWithDetails = attendance.map(a => {
            const session = sessionMap[a.session_id];
            const course = session ? courseMap[session.course_id] : null;
            return {
                ...a,
                session: session ? { ...session, course: course ? { title: course.title } : null } : null
            };
        });

        // Calculate attendance summary
        const total = attendanceWithDetails?.length || 0;
        const present = attendanceWithDetails?.filter(a => a.status === 'present').length || 0;
        const absent = attendanceWithDetails?.filter(a => a.status === 'absent').length || 0;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        res.json({ 
            attendance: attendanceWithDetails || [],
            summary: {
                total,
                present,
                absent,
                rate
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET CHILD'S ACHIEVEMENTS
router.get('/child/:childId/achievements', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: 'Only parents can access this' });
        }

        // Verify parent is linked to this child
        const { data: link } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', req.params.childId)
            .single();

        if (!link) {
            return res.status(403).json({ message: 'Not authorized to view this student\'s achievements' });
        }

        // Get student's stats
        const { data: stats } = await supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', req.params.childId)
            .single();

        // Get student's badges
        const { data: userBadges, ubError } = await supabase
            .from('user_badges')
            .select('*')
            .eq('user_id', req.params.childId);

        if (ubError) {
            return res.status(500).json({ message: ubError.message });
        }

        // Get badge IDs
        const badgeIds = (userBadges || []).map(ub => ub.badge_id).filter(id => id);
        
        // Fetch badges
        let badges = [];
        if (badgeIds.length > 0) {
            const { data: badgeData } = await supabase
                .from('badges')
                .select('*')
                .in('id', badgeIds);
            badges = badgeData || [];
        }

        // Create map
        const badgeMap = {};
        badges.forEach(b => { badgeMap[b.id] = b; });

        const achievements = (userBadges || []).map(ub => {
            const badge = badgeMap[ub.badge_id];
            return {
                id: badge?.id,
                name: badge?.name,
                description: badge?.description,
                icon: badge?.icon,
                earned_at: ub.earned_at
            };
        });

        res.json({ 
            achievements,
            stats: {
                xp: stats?.xp || 0,
                level: Math.floor(Math.sqrt((stats?.xp || 0) / 100)) + 1,
                streak_days: stats?.streak_days || 0
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET CHILD'S SUBMITTED ASSIGNMENTS
router.get('/child/:childId/assignments', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: 'Only parents can access this' });
        }

        // Verify parent is linked to this child
        const { data: link } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', req.params.childId)
            .single();

        if (!link) {
            return res.status(403).json({ message: 'Not authorized to view this student\'s assignments' });
        }

        // Get submissions
        const { data: submissions, error } = await supabase
            .from('submissions')
            .select('*')
            .eq('student_id', req.params.childId)
            .order('submitted_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        if (!submissions || submissions.length === 0) {
            return res.json({ assignments: [] });
        }

        // Get assignment IDs
        const assignmentIds = submissions.map(s => s.assignment_id);
        
        // Fetch assignments
        const { data: assignments, assignError } = await supabase
            .from('assignments')
            .select('*')
            .in('id', assignmentIds);

        if (assignError) {
            return res.status(500).json({ message: assignError.message });
        }

        // Get course IDs
        const courseIds = assignments.map(a => a.course_id).filter(id => id);
        
        // Fetch courses
        let courses = [];
        if (courseIds.length > 0) {
            const { data: courseData } = await supabase
                .from('courses')
                .select('id, title')
                .in('id', courseIds);
            courses = courseData || [];
        }

        // Create maps
        const assignmentMap = {};
        assignments.forEach(a => { assignmentMap[a.id] = a; });
        const courseMap = {};
        courses.forEach(c => { courseMap[c.id] = c; });

        const assignmentsWithDetails = submissions.map(sub => {
            const assignment = assignmentMap[sub.assignment_id];
            const course = assignment ? courseMap[assignment.course_id] : null;
            return {
                id: sub.id,
                title: assignment?.title || 'Unknown',
                description: assignment?.description,
                course_name: course?.title || 'Unknown',
                due_date: assignment?.due_date,
                points: assignment?.points || 100,
                grade: sub.grade,
                status: sub.status,
                submitted_at: sub.submitted_at,
                graded_at: sub.graded_at
            };
        });

        res.json({ assignments: assignmentsWithDetails });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper function to get letter grade
function getLetterGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
}

module.exports = router;
