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

// Get all quizzes for a course
router.get('/course/:courseId', authMiddleware, async (req, res) => {
    try {
        const { courseId } = req.params;
        
        // If student, check enrollment
        if (req.user.role === 'student') {
            const { data: enrollment } = await supabase
                .from('enrollments')
                .select('*')
                .eq('course_id', courseId)
                .eq('student_id', req.user.id)
                .single();
                
            if (!enrollment) return res.status(403).json({ message: 'Not enrolled in this course' });
        }

        const { data: quizzes, error } = await supabase
            .from('quizzes')
            .select('*')
            .eq('course_id', courseId);

        if (error) throw error;
        res.json({ quizzes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get a specific quiz with questions (Student/Teacher)
router.get('/:quizId', authMiddleware, async (req, res) => {
    try {
        const { quizId } = req.params;

        const { data: quiz, error: quizErr } = await supabase
            .from('quizzes')
            .select('*, courses(title)')
            .eq('id', quizId)
            .single();

        if (quizErr || !quiz) return res.status(404).json({ message: 'Quiz not found' });

        // If student, check if already submitted
        let alreadySubmitted = false;
        if (req.user.role === 'student') {
            const { data: submission } = await supabase
                .from('quiz_submissions')
                .select('*')
                .eq('quiz_id', quizId)
                .eq('student_id', req.user.id)
                .single();
            
            if (submission) alreadySubmitted = true;
        }

        const { data: questions, error: qErr } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('quiz_id', quizId);

        if (qErr) throw qErr;

        res.json({ quiz, questions, alreadySubmitted });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a quiz (Teacher only)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only teachers can create quizzes' });
        }
        const { course_id, title, description, time_limit, questions } = req.body;

        // 1. Create quiz
        const { data: quiz, error: quizErr } = await supabase
            .from('quizzes')
            .insert([{ 
                course_id, 
                teacher_id: req.user.id, 
                title, 
                description, 
                time_limit 
            }])
            .select()
            .single();

        if (quizErr) throw quizErr;

        // 2. Create questions
        const questionsToInsert = questions.map(q => ({
            quiz_id: quiz.id,
            question_text: q.question_text,
            options: q.options,
            correct_option: q.correct_option,
            marks: q.marks || 1
        }));

        const { error: qErr } = await supabase
            .from('quiz_questions')
            .insert(questionsToInsert);

        if (qErr) throw qErr;

        res.json({ message: 'Quiz created successfully', quizId: quiz.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Submit quiz (Student only)
router.post('/:quizId/submit', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can submit quizzes' });
        }
        const { quizId } = req.params;
        const { answers } = req.body; // Array of selected indices

        // 1. Get correct answers
        const { data: questions, error: qErr } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('quiz_id', quizId);

        if (qErr) throw qErr;

        // 2. Calculate score
        let score = 0;
        let totalMarks = 0;

        questions.forEach((q, index) => {
            totalMarks += q.marks;
            if (answers[index] !== undefined && answers[index] === q.correct_option) {
                score += q.marks;
            }
        });

        // 3. Save submission
        const { error: subErr } = await supabase
            .from('quiz_submissions')
            .insert([{
                quiz_id: quizId,
                student_id: req.user.id,
                score,
                total_marks: totalMarks
            }]);

        if (subErr) {
            if (subErr.code === '23505') return res.status(400).json({ message: 'Already submitted' });
            throw subErr;
        }

        res.json({ message: 'Quiz submitted successfully', score, totalMarks });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get quiz results for teacher
router.get('/:quizId/results', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only teachers can view results' });
        }
        const { quizId } = req.params;

        const { data: results, error } = await supabase
            .from('quiz_submissions')
            .select('*, users(full_name, email)')
            .eq('quiz_id', quizId);

        if (error) throw error;
        res.json({ results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
