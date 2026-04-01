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

// GET STUDENT'S GRADES (Student only)
router.get('/my-grades', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can access their grades' });
        }

        // Get all submissions with grades AND quiz attempts
        const [submissionsResult, quizAttemptsResult] = await Promise.all([
            supabase
                .from('submissions')
                .select(`
                    *,
                    assignment:assignments(
                        id,
                        title,
                        max_points,
                        course:courses(id, title, category)
                    )
                `)
                .eq('student_id', req.user.id)
                .not('grade', 'is', null),
            supabase
                .from('quiz_attempts')
                .select(`
                    *,
                    quiz:quizzes(
                        id,
                        title,
                        max_points,
                        course:courses(id, title, category)
                    )
                `)
                .eq('student_id', req.user.id)
                .not('score', 'is', null)
        ]);

        const submissions = submissionsResult.data || [];
        const quizAttempts = quizAttemptsResult.data || [];

        const allGrades = [
            ...submissions.map(submission => ({
                id: submission.id,
                type: 'assignment',
                title: submission.assignment.title || 'Unknown Assignment',
                course_name: submission.assignment.course?.title || 'Unknown',
                course_category: submission.assignment.course?.category || 'General',
                points: submission.assignment.max_points || 100,
                grade: submission.grade || 0,
                percentage: Math.round(((submission.grade || 0) / (submission.assignment.max_points || 100)) * 100),
                feedback: submission.feedback,
                submitted_at: submission.submitted_at || submission.created_at,
                graded_at: submission.graded_at || submission.updated_at
            })),
            ...quizAttempts.map(attempt => ({
                id: attempt.id,
                type: 'quiz',
                title: attempt.quiz.title || 'Unknown Quiz',
                course_name: attempt.quiz.course?.title || 'Unknown',
                course_category: attempt.quiz.course?.category || 'General',
                points: attempt.quiz.max_points || 100,
                grade: attempt.score || 0,
                percentage: Math.round(((attempt.score || 0) / (attempt.quiz.max_points || 100)) * 100),
                feedback: attempt.feedback,
                submitted_at: attempt.completed_at,
                graded_at: attempt.graded_at
            }))
        ];

        // Sort by graded_at desc
        allGrades.sort((a, b) => new Date(b.graded_at || b.submitted_at) - new Date(a.graded_at || a.submitted_at));

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        // Calculate overall grade
        let totalPoints = 0;
        let earnedPoints = 0;
        
        const gradesWithCourse = (submissions || []).map(submission => {
            const points = submission.assignment?.points || 100;
            const earned = submission.grade || 0;
            totalPoints += points;
            earnedPoints += earned;
            
            return {
                id: submission.id,
                assignment_title: submission.assignment?.title || 'Unknown',
                course_name: submission.assignment?.course?.title || 'Unknown',
                course_category: submission.assignment?.course?.category || 'General',
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

// GET COURSE GRADES (Teacher only) - Now includes Quizzes
router.get('/course/:courseId', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can view course grades' });
        }

        // Verify teacher owns the course
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .eq('id', req.params.courseId);

        if (courseError || !course || course.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }

        if (course[0].teacher_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Get assignments
        const assignments = await supabase
            .from('assignments')
            .select('*')
            .eq('course_id', req.params.courseId);

        // Get quizzes
        const quizzes = await supabase
            .from('quizzes')
            .select('*')
            .eq('course_id', req.params.courseId);

        const assessIds = [...(assignments.data || []).map(a => a.id), ...(quizzes.data || []).map(q => q.id)];

        // Get submissions AND quiz_attempts
        const [subsResult, attemptsResult, enrollmentsResult] = await Promise.all([
            supabase.from('submissions').select(`
                    *,
                    student:users(id, full_name, email),
                    assignment!inner(id, title, max_points)
                `).in('assignment_id', (assignments.data || []).map(a => a.id)),
            supabase.from('quiz_attempts').select(`
                    *,
                    student:users(id, full_name, email),
                    quiz!inner(id, title, max_points)
                `).in('quiz_id', (quizzes.data || []).map(q => q.id)),
            supabase.from('enrollments').select('*, student:users(id, full_name, email)').eq('course_id', req.params.courseId)
        ]);

        const submissions = subsResult.data || [];
        const quizAttempts = attemptsResult.data || [];
        const enrollments = enrollmentsResult.data || [];

        // Organize by student
        const studentGrades = {};
        enrollments.forEach(enrollment => {
            const studentId = enrollment.student_id;
            if (!studentGrades[studentId]) {
                studentGrades[studentId] = {
                    student: enrollment.student,
                    assessments: [],
                    total_points: 0,
                    earned_points: 0
                };
            }
        });

        submissions.forEach(submission => {
            const studentId = submission.student_id;
            if (studentGrades[studentId]) {
                const points = submission.assignment.max_points || 100;
                const grade = submission.grade || 0;
                studentGrades[studentId].assessments.push({
                    type: 'assignment',
                    title: submission.assignment.title,
                    points,
                    grade,
                    percentage: Math.round((grade / points) * 100),
                    submitted_at: submission.submitted_at
                });
                studentGrades[studentId].total_points += points;
                studentGrades[studentId].earned_points += grade;
            }
        });

        quizAttempts.forEach(attempt => {
            const studentId = attempt.student_id;
            if (studentGrades[studentId]) {
                const points = attempt.quiz.max_points || 100;
                const grade = attempt.score || 0;
                studentGrades[studentId].assessments.push({
                    type: 'quiz',
                    title: attempt.quiz.title,
                    points,
                    grade,
                    percentage: Math.round((grade / points) * 100),
                    submitted_at: attempt.completed_at
                });
                studentGrades[studentId].total_points += points;
                studentGrades[studentId].earned_points += grade;
            }
        });

        const finalGrades = Object.values(studentGrades).map(student => ({
            student: student.student,
            assessments: student.assessments,
            total_points: student.total_points,
            earned_points: student.earned_points,
            percentage: student.total_points > 0 ? Math.round((student.earned_points / student.total_points) * 100) : 0,
            letter_grade: getLetterGrade(student.total_points > 0 ? (student.earned_points / student.total_points) * 100 : 0)
        }));

        res.json({ 
            course: course[0],
            assignments: assignments.data || [],
            quizzes: quizzes.data || [],
            student_grades: finalGrades
        });

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
