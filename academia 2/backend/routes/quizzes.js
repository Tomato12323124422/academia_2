const express = require('express');
const router = express.Router();
const supabase = require('../utils/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Auth middleware
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'No token' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const { data: user } = await supabase.from('users').select('id, role').eq('id', decoded.id).single();

        if (!user) return res.status(401).json({ error: 'Invalid user' });
        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Helper: validate UUID
const isValidUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

// 1. POST /api/quizzes (teacher)
router.post('/', authMiddleware, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teacher only' });
    const { course_id, title, description, duration } = req.body;
    if (!course_id || !title || !duration) return res.status(400).json({ error: 'Missing fields' });
    if (!isValidUUID(course_id)) return res.status(400).json({ error: 'Invalid course_id' });

    // Check teacher owns course
    const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', course_id).single();
    if (!course || course.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your course' });

    const { data, error } = await supabase.from('quizzes').insert([{ course_id, title, description, duration, created_at: new Date().toISOString() }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ quiz: data });
});

// 2. POST /api/quizzes/:quizId/questions (teacher)
router.post('/:quizId/questions', authMiddleware, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teacher only' });
    const quizId = req.params.quizId;
    if (!isValidUUID(quizId)) return res.status(400).json({ error: 'Invalid quizId' });

    const { question, options, correct_answer } = req.body;
    if (!question || !correct_answer) return res.status(400).json({ error: 'Missing question or correct_answer' });

    // Check owns quiz
    const { data: quiz } = await supabase.from('quizzes').select('course_id').eq('id', quizId).single();
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', quizId.course_id).single();
    if (!course || course.teacher_id !== req.user.id) return res.status(403).json({ error: 'Not your quiz' });

    const insertData = {
        quiz_id: quizId,
        question,
        options: options || null,
        correct_answer
    };
    const { data, error } = await supabase.from('questions').insert([insertData]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ question: data });
});

// 3. GET /api/quizzes/course/:courseId
router.get('/course/:courseId', authMiddleware, async (req, res) => {
    const courseId = req.params.courseId;
    if (!isValidUUID(courseId)) return res.status(400).json({ error: 'Invalid courseId' });

    // Check access: teacher owns or student enrolled
    let hasAccess = false;
    if (req.user.role === 'teacher') {
        const { data: course } = await supabase.from('courses').select('teacher_id').eq('id', courseId).single();
        hasAccess = course && course.teacher_id === req.user.id;
    } else if (req.user.role === 'student') {
        const { data } = await supabase.from('enrollments').select('id').eq('course_id', courseId).eq('student_id', req.user.id);
        hasAccess = data && data.length > 0;
    }

    if (!hasAccess) return res.status(403).json({ error: 'No access' });

    const { data, error } = await supabase.from('quizzes').select('*').eq('course_id', courseId).order('created_at');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ quizzes: data });
});

// 4. GET /api/quizzes/:quizId (hide correct_answer for student)
router.get('/:quizId', authMiddleware, async (req, res) => {
    const quizId = req.params.quizId;
    if (!isValidUUID(quizId)) return res.status(400).json({ error: 'Invalid quizId' });

    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    // Check access (same as above)
    // ... (omit for brevity, similar)

    let qselect = 'id, question, options';
    if (req.user.role === 'teacher') qselect += ', correct_answer';

    const { data: questions } = await supabase.from('questions').select(qselect).eq('quiz_id', quizId);
    res.json({ quiz, questions });
});

// 5. POST /api/quizzes/:quizId/submit (student enrolled)
router.post('/:quizId/submit', authMiddleware, async (req, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Student only' });
    const quizId = req.params.quizId;
    if (!isValidUUID(quizId)) return res.status(400).json({ error: 'Invalid quizId' });

    const { answers } = req.body; // {questionId: option}
    if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'Answers required' });

    // Check enrolled
    const { data: quiz } = await supabase.from('quizzes').select('course_id').eq('id', quizId).single();
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    const { data: enrollment } = await supabase.from('enrollments').select('id').eq('course_id', quiz.course_id).eq('student_id', req.user.id);
    if (!enrollment || enrollment.length === 0) return res.status(403).json({ error: 'Not enrolled' });

    // Check no duplicate attempt
    const { data: existing } = await supabase.from('quiz_attempts').select('id').eq('quiz_id', quizId).eq('student_id', req.user.id);
    if (existing && existing.length > 0) return res.status(409).json({ error: 'Attempt already submitted' });

    // Get questions for scoring
    const { data: questions } = await supabase.from('questions').select('*').eq('quiz_id', quizId);
    let score = 0;
    const total = questions.length;
    questions.forEach(q => {
        if (answers[q.id] === q.correct_answer) score++;
    });
    const percentage = Math.round((score / total) * 100);

    // Insert attempt
    const { data: attempt, error: aError } = await supabase.from('quiz_attempts').insert([{
        quiz_id: quizId,
        student_id: req.user.id,
        score: percentage,
        submitted_at: new Date().toISOString()
    }]).select().single();
    if (aError) return res.status(500).json({ error: aError.message });

    // Insert answers
    const answerInserts = Object.entries(answers).map(([qId, ans]) => ({
        attempt_id: attempt.id,
        question_id: qId,
        selected_answer: ans
    }));
    const { error: ansError } = await supabase.from('quiz_answers').insert(answerInserts);
    if (ansError) return res.status(500).json({ error: ansError.message });

    res.json({ score: percentage, total_questions: total, correct: score });
});

// 6. GET /api/quizzes/:quizId/results (teacher)
router.get('/:quizId/results', authMiddleware, async (req, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Teacher/admin only' });
    const quizId = req.params.quizId;
    if (!isValidUUID(quizId)) return res.status(400).json({ error: 'Invalid quizId' });

    // Check owns
    // ... similar

    const { data, error } = await supabase.from('quiz_attempts')
        .select('*, student:users(full_name, email)')
        .eq('quiz_id', quizId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ attempts: data });
});

module.exports = router;

