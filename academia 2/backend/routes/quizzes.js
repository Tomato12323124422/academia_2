const express = require('express');
const router = express.Router();
const supabase = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

// Auth middleware (same as courses.js)
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

// Validate UUID
function isValidUUID(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// 1. POST /api/quizzes - Create quiz (teacher only)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can create quizzes' });
        }

        const { course_id, title, description, duration } = req.body;

        if (!course_id || !title || !duration) {
            return res.status(400).json({ message: 'course_id, title, duration required' });
        }

        if (!isValidUUID(course_id)) {
            return res.status(400).json({ message: 'Invalid course_id UUID' });
        }

        // Check teacher owns course
        const { data: course } = await supabase
            .from('courses')
            .select('teacher_id')
            .eq('id', course_id)
            .single();

        if (!course || course.teacher_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized for this course' });
        }

        const quizId = uuidv4();

        const { data, error } = await supabase
            .from('quizzes')
            .insert([{
                id: quizId,
                course_id,
                title,
                description: description || '',
                duration: parseInt(duration),
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.status(201).json({ message: 'Quiz created', quiz: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// 2. POST /api/quizzes/:quizId/questions - Add question
router.post('/:quizId/questions', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can add questions' });
        }

        const { quizId } = req.params;
        const { question, options, correct_answer } = req.body;

        if (!isValidUUID(quizId) || !question || !correct_answer) {
            return res.status(400).json({ message: 'Valid quizId, question, correct_answer required' });
        }

        // Check owns quiz
        const { data: quiz } = await supabase
            .from('quizzes')
            .select('course_id')
            .eq('id', quizId)
            .single();

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const { data: course } = await supabase
            .from('courses')
            .select('teacher_id')
            .eq('id', quiz.course_id)
            .single();

        if (!course || course.teacher_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const questionId = uuidv4();

        const { data, error } = await supabase
            .from('questions')
            .insert([{
                id: questionId,
                quiz_id: quizId,
                question,
                options: options || null,
                correct_answer
            }])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.status(201).json({ message: 'Question added', question: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// 3. GET /api/quizzes/course/:courseId
router.get('/course/:courseId', authMiddleware, async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!isValidUUID(courseId)) {
            return res.status(400).json({ message: 'Invalid course ID' });
        }

        // Check access
        let hasAccess = false;
        if (req.user.role === 'teacher') {
            const { data: course } = await supabase
                .from('courses')
                .select('teacher_id')
                .eq('id', courseId)
                .single();
            hasAccess = course && course.teacher_id === req.user.id;
        } else if (req.user.role === 'student') {
            const { data: enrollment } = await supabase
                .from('enrollments')
                .select('*')
                .eq('course_id', courseId)
                .eq('student_id', req.user.id);
            hasAccess = enrollment.length > 0;
        }

        if (!hasAccess) {
            return res.status(403).json({ message: 'Not authorized for this course' });
        }

        const { data, error } = await supabase
            .from('quizzes')
            .select('*')
            .eq('course_id', courseId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ quizzes: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// 4. GET /api/quizzes/:quizId (no correct answers)
router.get('/:quizId', authMiddleware, async (req, res) => {
    try {
        const { quizId } = req.params;

        if (!isValidUUID(quizId)) {
            return res.status(400).json({ message: 'Invalid quiz ID' });
        }

        // Check enrolled or teacher
        const { data: quiz } = await supabase
            .from('quizzes')
            .select('course_id')
            .eq('id', quizId)
            .single();

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        let hasAccess = false;
        if (req.user.role === 'teacher') {
            const { data: course } = await supabase
                .from('courses')
                .select('teacher_id')
                .eq('id', quiz.course_id)
                .single();
            hasAccess = course.teacher_id === req.user.id;
        } else if (req.user.role === 'student') {
            const { data: enrollment } = await supabase
                .from('enrollments')
                .select('*')
                .eq('course_id', quiz.course_id)
                .eq('student_id', req.user.id);
            hasAccess = enrollment.length > 0;
        }

        if (!hasAccess) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { data: questions, error } = await supabase
            .from('questions')
            .select('id, question, options') // NO correct_answer
            .eq('quiz_id', quizId);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ quiz, questions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
        }
});

// 5. POST /api/quizzes/:quizId/submit
router.post('/:quizId/submit', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can submit quizzes' });
        }

        const { quizId } = req.params;
        const { answers } = req.body; // { questionId: selectedOption }

        if (!isValidUUID(quizId)) {
            return res.status(400).json({ message: 'Invalid quiz ID' });
        }

        // Check enrolled
        const { data: quiz } = await supabase
            .from('quizzes')
            .select('course_id')
            .eq('id', quizId)
            .single();

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const { data: enrollment } = await supabase
            .from('enrollments')
            .select('*')
            .eq('course_id', quiz.course_id)
            .eq('student_id', req.user.id);

        if (enrollment.length === 0) {
            return res.status(403).json({ message: 'Must be enrolled in course' });
        }

        // Check duplicate attempt
        const { data: existing } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('quiz_id', quizId)
            .eq('student_id', req.user.id);

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Already submitted this quiz' });
        }

        // Get questions with correct answers to score
        const { data: questions, error } = await supabase
            .from('questions')
            .select('*') // Full for scoring
            .eq('quiz_id', quizId);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        let score = 0;
        let total = questions.length;
        const questionAnswers = [];

        questions.forEach(q => {
            const studentAnswer = answers[q.id];
            const correct = q.correct_answer;
            if (studentAnswer === correct) {
                score++;
            }
            questionAnswers.push({
                attempt_id: null, // Will set after insert
                question_id: q.id,
                selected_answer: studentAnswer || null
            });
        });

        const attemptId = uuidv4();

        // Insert attempt
        const { data: attempt, error: attemptError } = await supabase
            .from('quiz_attempts')
            .insert([{
                id: attemptId,
                quiz_id: quizId,
                student_id: req.user.id,
                score: score,
                submitted_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (attemptError) {
            return res.status(500).json({ message: attemptError.message });
        }

        // Insert answers
        questionAnswers.forEach(ans => ans.attempt_id = attemptId);
        const { error: answersError } = await supabase
            .from('quiz_answers')
            .insert(questionAnswers);

        if (answersError) {
            // Cleanup attempt if answers fail
            await supabase.from('quiz_attempts').delete().eq('id', attemptId);
            return res.status(500).json({ message: answersError.message });
        }

        res.json({ 
            message: 'Quiz submitted successfully',
            score: score,
            total_questions: total,
            percentage: Math.round((score / total) * 100)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// 6. GET /api/quizzes/:quizId/results (teacher/admin)
router.get('/:quizId/results', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Teacher/admin only' });
        }

        const { quizId } = req.params;

        if (!isValidUUID(quizId)) {
            return res.status(400).json({ message: 'Invalid quiz ID' });
        }

        // Check authorized
        const { data: quiz } = await supabase
            .from('quizzes')
            .select('course_id')
            .eq('id', quizId)
            .single();

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        if (req.user.role === 'teacher') {
            const { data: course } = await supabase
                .from('courses')
                .select('teacher_id')
                .eq('id', quiz.course_id)
                .single();
            if (!course || course.teacher_id !== req.user.id) {
                return res.status(403).json({ message: 'Not authorized' });
            }
        }

        const { data, error } = await supabase
            .from('quiz_attempts')
            .select(`
                *,
                student:users(full_name, email),
                answers:quiz_answers!inner(*)
            `)
            .eq('quiz_id', quizId)
            .order('submitted_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ attempts: data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

