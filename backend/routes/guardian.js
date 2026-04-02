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
            console.error('Error fetching parent-student links:', error);
            return res.status(500).json({ message: error.message });
        }

        if (!links || links.length === 0) {
            return res.json({ children: [] });
        }

        // Get student IDs to fetch
        const studentIds = links.map(link => link.student_id);
        
        // Fetch student details separately
        const { data: students, error: studentError } = await supabase
            .from('users')
            .select('id, full_name, email, role')
            .in('id', studentIds);

        if (studentError) {
            console.error('Error fetching student details:', studentError);
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
        console.error('Guardian children error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// SEARCH STUDENT BY EMAIL
router.get('/search-student-by-email', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') {
            return res.status(403).json({ message: 'Only parents can search for students' });
        }

        const email = req.query.email;
        if (!email || email.length < 2) {
            return res.status(400).json({ message: 'Please enter at least 2 characters' });
        }

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
        console.error('Student search error:', err);
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
        if (!email) return res.status(400).json({ message: 'Student email is required' });

        const { data: student, error: studentError } = await supabase
            .from('users')
            .select('id, full_name, email, role')
            .eq('email', email.toLowerCase())
            .eq('role', 'student')
            .single();

        if (studentError || !student) {
            return res.status(404).json({ message: 'Student not found with this email' });
        }

        const { data: existingLink } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', student.id)
            .single();

        if (existingLink) {
            return res.status(400).json({ message: 'This student is already linked to your account' });
        }

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
        console.error('Linking error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET CHILD'S ENROLLED COURSES
router.get('/child/:childId/courses', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') return res.status(403).json({ message: 'Only parents can access this' });

        const { data: link } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', req.params.childId)
            .single();

        if (!link) return res.status(403).json({ message: 'Not authorized' });

        const { data: enrollments, error } = await supabase
            .from('enrollments')
            .select('*')
            .eq('student_id', req.params.childId);

        if (error) return res.status(500).json({ message: error.message });
        if (!enrollments || enrollments.length === 0) return res.json({ courses: [] });

        const courseIds = enrollments.map(e => e.course_id);
        const { data: courses, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .in('id', courseIds);

        if (courseError) return res.status(500).json({ message: courseError.message });

        const teacherIds = courses.map(c => c.teacher_id).filter(id => id);
        let teachers = [];
        if (teacherIds.length > 0) {
            const { data: teacherData } = await supabase.from('users').select('id, full_name').in('id', teacherIds);
            teachers = teacherData || [];
        }

        const teacherMap = {};
        teachers.forEach(t => { teacherMap[t.id] = t; });

        const coursesWithDetails = courses.map(course => ({
            id: course.id,
            title: course.title,
            description: course.description,
            category: course.category,
            duration: course.duration,
            teacher: teacherMap[course.teacher_id]?.full_name || 'Unknown'
        }));

        res.json({ courses: coursesWithDetails });

    } catch (err) {
        console.error('Child courses error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET CHILD'S GRADES
router.get('/child/:childId/grades', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') return res.status(403).json({ message: 'Only parents can access this' });

        const { data: link } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', req.params.childId)
            .single();

        if (!link) return res.status(403).json({ message: 'Not authorized' });

        const { data: submissions, error } = await supabase
            .from('submissions')
            .select('*, assignment:assignments(*, course:courses(title))')
            .eq('student_id', req.params.childId)
            .not('grade', 'is', null)
            .order('graded_at', { ascending: false });

        if (error) {
            console.error('Submission error:', error);
            return res.status(500).json({ message: error.message });
        }

        const { data: quizSubmissions, error: quizError } = await supabase
            .from('quiz_submissions')
            .select('*, quiz:quizzes(*, course:courses(title))')
            .eq('student_id', req.params.childId)
            .order('submitted_at', { ascending: false });

        if (quizError) {
            console.error('Quiz submission error:', quizError);
            return res.status(500).json({ message: quizError.message });
        }

        let totalPoints = 0;
        let earnedPoints = 0;
        const allGrades = [];

        (submissions || []).forEach(sub => {
            const assignment = sub.assignment || {};
            const course = assignment.course || {};
            const points = assignment.points || 100;
            const earned = sub.grade || 0;
            totalPoints += points;
            earnedPoints += earned;

            allGrades.push({
                id: `assign_${sub.id}`,
                assignment_title: assignment.title || 'Unknown Assignment',
                course_name: course.title || 'Unknown Course',
                points,
                grade: earned,
                percentage: points > 0 ? Math.round((earned / points) * 100) : 0,
                feedback: sub.feedback,
                graded_at: sub.graded_at,
                type: 'assignment'
            });
        });

        (quizSubmissions || []).forEach(sub => {
            const quiz = sub.quiz || {};
            const course = quiz.course || {};
            const points = sub.total_marks || 100;
            const earned = sub.score || 0;
            totalPoints += points;
            earnedPoints += earned;

            allGrades.push({
                id: `quiz_${sub.id}`,
                assignment_title: quiz.title ? `Quiz: ${quiz.title}` : 'Unknown Quiz',
                course_name: course.title || 'Unknown Course',
                points,
                grade: earned,
                percentage: points > 0 ? Math.round((earned / points) * 100) : 0,
                feedback: null,
                graded_at: sub.submitted_at,
                type: 'quiz'
            });
        });

        allGrades.sort((a, b) => new Date(b.graded_at || 0) - new Date(a.graded_at || 0));

        const overallGrade = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

        res.json({ 
            grades: allGrades,
            overall: {
                total_points: totalPoints,
                earned_points: earnedPoints,
                percentage: overallGrade,
                letter_grade: getLetterGrade(overallGrade)
            }
        });

    } catch (err) {
        console.error('Child grades error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET CHILD'S ATTENDANCE
router.get('/child/:childId/attendance', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') return res.status(403).json({ message: 'Only parents can access this' });

        const { data: link } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', req.params.childId)
            .single();

        if (!link) return res.status(403).json({ message: 'Not authorized' });

        const { data: attendance, error } = await supabase
            .from('attendance')
            .select('*, session:sessions(*, course:courses(title))')
            .eq('student_id', req.params.childId)
            .order('marked_at', { ascending: false });

        if (error) return res.status(500).json({ message: error.message });

        const total = attendance?.length || 0;
        const present = attendance?.filter(a => a.status === 'present').length || 0;
        const rate = total > 0 ? Math.round((present / total) * 100) : 0;

        res.json({ 
            attendance: attendance || [],
            summary: { total, present, rate }
        });

    } catch (err) {
        console.error('Attendance error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET CHILD'S SUBMITTED ASSIGNMENTS
router.get('/child/:childId/assignments', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'parent') return res.status(403).json({ message: 'Only parents can access this' });

        const { data: link } = await supabase
            .from('parent_student')
            .select('*')
            .eq('parent_id', req.user.id)
            .eq('student_id', req.params.childId)
            .single();

        if (!link) return res.status(403).json({ message: 'Not authorized' });

        const { data: submissions, error } = await supabase
            .from('submissions')
            .select('*, assignment:assignments(*, course:courses(title))')
            .eq('student_id', req.params.childId)
            .order('submitted_at', { ascending: false });

        if (error) return res.status(500).json({ message: error.message });

        const { data: quizSubmissions, error: quizError } = await supabase
            .from('quiz_submissions')
            .select('*, quiz:quizzes(*, course:courses(title))')
            .eq('student_id', req.params.childId)
            .order('submitted_at', { ascending: false });

        if (quizError) return res.status(500).json({ message: quizError.message });

        const formattedAssignments = [];
        
        (submissions || []).forEach(sub => {
             const assignment = sub.assignment || {};
             const course = assignment.course || {};
             formattedAssignments.push({
                  id: `assign_${sub.id}`,
                  title: assignment.title || 'Unknown Assignment',
                  course_name: course.title || 'Unknown Course',
                  due_date: assignment.due_date,
                  status: sub.grade !== null ? 'graded' : 'submitted',
                  grade: sub.grade,
                  points: assignment.points || 100,
                  submitted_at: sub.submitted_at
             });
        });

        (quizSubmissions || []).forEach(sub => {
             const quiz = sub.quiz || {};
             const course = quiz.course || {};
             formattedAssignments.push({
                  id: `quiz_${sub.id}`,
                  title: quiz.title ? `Quiz: ${quiz.title}` : 'Unknown Quiz',
                  course_name: course.title || 'Unknown Course',
                  due_date: null,
                  status: 'graded',
                  grade: sub.score,
                  points: sub.total_marks || 100,
                  submitted_at: sub.submitted_at
             });
        });

        formattedAssignments.sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0));

        res.json({ assignments: formattedAssignments });

    } catch (err) {
        console.error('Assignments error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

function getLetterGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
}

module.exports = router;
