const express = require('express');
const router = express.Router();
const supabase = require('../utils/db');

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Middleware to verify JWT token
const authMiddleware = async (req, res, next) => {
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

        req.user = user[0];
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// CREATE LIVE CLASS (Teacher only) - FIX start_time NULL
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const { course_id, title, zoom_link, scheduled_at } = req.body;
        
        if (!course_id || !title || !zoom_link || !scheduled_at) {
            return res.status(400).json({ message: 'course_id, title, zoom_link, scheduled_at required' });
        }

        // Verify teacher owns course
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .eq('id', course_id)
            .eq('teacher_id', req.user.id)
            .single();

        if (courseError || !course) {
            return res.status(403).json({ message: 'Only own courses' });
        }

        const scheduledDate = new Date(scheduled_at);
        const { data, error } = await supabase
            .from('sessions')
            .insert([{
                course_id,
                teacher_id: req.user.id,
                date: scheduledDate.toISOString(),
                start_time: scheduledDate.toISOString(),
                zoom_link,
                topic: title, // title is what we get from body, topic is what's in DB
                status: 'scheduled'
            }])
            .select()
            .single();

        if (error) {
            console.error('Sessions insert error:', error);
            return res.status(500).json({ message: error.message });
        }

        res.status(201).json({ message: 'Class created', session: data });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET course sessions
router.get('/course/:courseId', authMiddleware, async (req, res) => {
    try {
        const courseId = req.params.courseId;

        if (req.user.role === 'student') {
            const { data: enrollment } = await supabase
                .from('enrollments')
                .select('id')
                .eq('course_id', courseId)
                .eq('student_id', req.user.id)
                .single();
            if (!enrollment) return res.status(403).json({ message: 'Enroll first' });
        }

        const { data: sessions, error } = await supabase
            .from('sessions')
            .select(`
                *,
                course!inner(title)
            `)
            .eq('course_id', courseId)
            .order('date', { ascending: true });

        if (error) return res.status(500).json({ message: error.message });
        res.json({ sessions: sessions || [] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET upcoming (role filtered)
router.get('/upcoming', authMiddleware, async (req, res) => {
    try {
        let courseIds = [];
        
        if (req.user.role === 'student') {
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('course_id')
                .eq('student_id', req.user.id);
            courseIds = enrollments?.map(e => e.course_id) || [];
        } else if (req.user.role === 'teacher') {
            const { data: courses } = await supabase
                .from('courses')
                .select('id')
                .eq('teacher_id', req.user.id);
            courseIds = courses?.map(c => c.id) || [];
        } else {
            return res.status(403).json({ message: 'Unauthorized role' });
        }

        if (courseIds.length === 0) {
            return res.json({ sessions: [] });
        }

        const now = new Date().toISOString();
        const { data: sessions, error } = await supabase
            .from('sessions')
            .select('*')
            .in('course_id', courseIds)
            .gte('date', now)
            .order('date', { ascending: true });

        if (error) return res.status(500).json({ message: error.message });
        res.json({ sessions: sessions || [] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;

