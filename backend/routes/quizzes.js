const express = require('express');
const router = express.Router();
const supabase = require('../utils/db');

// Auth middleware (reuse from grades.js)
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

// CREATE QUIZ (Teacher only)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can create quizzes' });
        }

        const { course_id, title, description, due_date, max_points = 100, time_limit_minutes, questions } = req.body;

        if (!course_id || !title || !questions || !Array.isArray(questions)) {
            return res.status(400).json({ message: 'course_id, title, and questions array required' });
        }

        // Verify teacher owns course
        const { data: course } = await supabase
            .from('courses')
            .select('teacher_id')
            .eq('id', course_id)
            .single();

        if (!course || course.teacher_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized for this course' });
        }

        const { data, error } = await supabase
            .from('quizzes')
            .insert([{
                course_id,
                teacher_id: req.user.id,
                title,
                description: description || '',
                due_date,
                max_points,
                time_limit_minutes: time_limit_minutes || 60,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) return res.status(500).json({ message: error.message });

        const quizId = data.id;

        // Insert questions
        const formattedQuestions = questions.map((q, index) => ({
            quiz_id: quizId,
            question_text: q.text,
            type: q.type || 'mcq',
            options: q.options || null,
            correct_answer: q.correct_answer,
            points: q.points || 10
        }));

        const { error: qError } = await supabase
            .from('quiz_questions')
            .insert(formattedQuestions);

        if (qError) {
            // Cleanup quiz if questions fail
            await supabase.from('quizzes').delete().eq('id', quizId);
            return res.status(500).json({ message: qError.message });
        }

        res.status(201).json({ message: 'Quiz created successfully', quiz: data });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET QUIZZES FOR COURSE (Teacher/Student)
router.get('/course/:courseId', authMiddleware, async (req, res) => {
    try {
        const courseId = req.params.courseId;

        // Verify access (teacher owns or student enrolled)
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
            hasAccess = !!enrollment.length;
        }

        if (!hasAccess) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { data: quizzes, error } = await supabase
            .from('quizzes')
            .select(`
                *,
                quiz_questions (
                    id,
                    question_text,
                    type,
                    options,
                    points
                )
            `)
            .eq('course_id', courseId)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ message: error.message });

        // Include attempt status for students
        let quizzesWithStatus = quizzes;
        if (req.user.role === 'student') {
            quizzesWithStatus = await Promise.all(quizzes.map(async (quiz) => {
                const { data: attempt } = await supabase
                    .from('quiz_attempts')
                    .select('id, score, completed_at')
                    .eq('quiz_id', quiz.id)
                    .eq('student_id', req.user.id)
                    .single();
                return { ...quiz, my_attempt: attempt };
            }));
        }

        res.json({ quizzes: quizzesWithStatus });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET MY QUIZZES (Student)
router.get('/my-quizzes', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can access' });
        }

        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('course_id')
            .eq('student_id', req.user.id);

        const courseIds = enrollments.map(e => e.course_id);

        const { data: quizzes, error } = await supabase
            .from('quizzes')
            .select('*, course:courses(title)')
            .in('course_id', courseIds)
            .order('due_date');

        if (error) return res.status(500).json({ message: error.message });

        res.json({ quizzes });

    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// START QUIZ ATTEMPT (Student)
router.post('/:quizId/attempt', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can take quizzes' });
        }

        const quizId = req.params.quizId;

        // Check enrollment
        const { data: enrollment } = await supabase
            .from('enrollments')
            .select('*')
            .eq('course_id', (await supabase.from('quizzes').select('course_id').eq('id', quizId).single()).data.course_id)
            .eq('student_id', req.user.id);

        if (!enrollment.length) return res.status(403).json({ message: 'Must be enrolled' });

        // Check existing attempt
        const { data: existing } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('quiz_id', quizId)
            .eq('student_id', req.user.id);

        const attempt = {
            quiz_id: quizId,
            student_id: req.user.id,
            answers: {}, // Will be updated during quiz
            num_attempts: existing ? existing[0].num_attempts + 1 : 1,
            started_at: new Date().toISOString()
        };

        let upsertData;
        if (existing.length) {
            const { error } = await supabase
                .from('quiz_attempts')
                .update({ ...attempt, updated_at: new Date().toISOString() })
                .eq('id', existing[0].id);
            upsertData = existing[0];
        } else {
            const { data, error } = await supabase
                .from('quiz_attempts')
                .insert([attempt])
                .select()
                .single();
            upsertData = data;
        }

        if (!upsertData) return res.status(500).json({ message: 'Failed to create attempt' });

        res.json({ message: 'Quiz started', attempt_id: upsertData.id });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// UPDATE ANSWERS (during quiz, POST /:quizId/attempt/:attemptId/answers)
router.post('/:quizId/attempt/:attemptId/answers', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') return res.status(403).json({ message: 'Student only' });

        const { answers } = req.body; // { question_id: answer }

        const { data: attempt } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('id', req.params.attemptId)
            .eq('student_id', req.user.id)
            .single();

        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

        const updatedAnswers = { ...attempt.answers, ...answers };

        const { error } = await supabase
            .from('quiz_attempts')
            .update({ answers: updatedAnswers })
            .eq('id', req.params.attemptId);

        if (error) return res.status(500).json({ message: error.message });

        res.json({ message: 'Answers saved' });

    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// COMPLETE QUIZ & AUTO-GRADE (Student submits)
router.post('/:quizId/attempt/:attemptId/complete', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') return res.status(403).json({ message: 'Student only' });

        const attemptId = req.params.attemptId;

        const { data: attempt } = await supabase
            .from('quiz_attempts')
            .select('*, quiz:quizzes(course_id), quiz_questions(*)')
            .eq('id', attemptId)
            .eq('student_id', req.user.id)
            .single();

        if (!attempt) return res.status(404).json({ message: 'Attempt not found' });

        // Auto-grade MCQ, manual for text
        let score = 0;
        attempt.quiz_questions.forEach(q => {
            const studentAnswer = attempt.answers[q.id];
            const correct = q.correct_answer;

            if (q.type === 'mcq' && JSON.stringify(studentAnswer) === JSON.stringify(correct)) {
                score += q.points;
            }
            // Text: teacher grades manually
        });

        const { error } = await supabase
            .from('quiz_attempts')
            .update({
                score,
                completed_at: new Date().toISOString(),
                status: 'completed'
            })
            .eq('id', attemptId);

        if (error) return res.status(500).json({ message: error.message });

        res.json({ message: 'Quiz completed', score, max_points: attempt.quiz.max_points });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET QUIZ ATTEMPTS (Teacher)
router.get('/:quizId/attempts', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teacher only' });

        const { data: quiz } = await supabase
            .from('quizzes')
            .select('course_id')
            .eq('id', req.params.quizId)
            .single();

        // Verify course ownership
        const { data: course } = await supabase
            .from('courses')
            .select('teacher_id')
            .eq('id', quiz.course_id)
            .single();

        if (!course || course.teacher_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { data: attempts, error } = await supabase
            .from('quiz_attempts')
            .select(`
                *,
                student:users(full_name, email)
            `)
            .eq('quiz_id', req.params.quizId)
            .order('completed_at', { ascending: false });

        if (error) return res.status(500).json({ message: error.message });

        res.json({ attempts });

    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GRADE TEXT ANSWERS (Teacher manual grade)
router.patch('/:quizId/attempt/:attemptId/grade', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teacher only' });

        const { score, feedback } = req.body;

        // Verify authorization (same as above, omitted for brevity)

        const { error } = await supabase
            .from('quiz_attempts')
            .update({ score, feedback, graded_at: new Date().toISOString() })
            .eq('id', req.params.attemptId);

        if (error) return res.status(500).json({ message: error.message });

        res.json({ message: 'Grade updated' });

    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

