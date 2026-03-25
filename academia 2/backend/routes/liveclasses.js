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

// CREATE LIVE CLASS (Teacher only)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const { course_id, title, zoom_link, scheduled_at } = req.body;
        
        if (!course_id || !title || !zoom_link || !scheduled_at) {
            return res.status(400).json({ message: 'course_id, title, zoom_link, scheduled_at are required' });
        }

        // Verify teacher owns this course
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .eq('id', course_id)
            .eq('teacher_id', req.user.id);

        if (courseError || !course || course.length === 0) {
            return res.status(403).json({ message: 'You can only create classes for your own courses' });
        }

        const { data, error } = await supabase
            .from('live_classes')
            .insert([{
                course_id,
                title,
                zoom_link,
                scheduled_at: new Date(scheduled_at).toISOString()
            }])
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.status(201).json({ message: 'Class scheduled successfully', liveClass: data[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET LIVE CLASSES BY COURSE (Student enrolled only)
router.get('/course/:courseId', authMiddleware, async (req, res) => {
    try {
        const courseId = req.params.courseId;

        // Check if student is enrolled (for students) or teacher owns course (for teachers)
        if (req.user.role === 'student') {
            const { data: enrollment, error } = await supabase
                .from('enrollments')
                .select('id')
                .eq('course_id', courseId)
                .eq('student_id', req.user.id);

            if (error || !enrollment || enrollment.length === 0) {
                return res.status(403).json({ message: 'You must be enrolled to view classes' });
            }
        }

        const { data: liveClasses, error } = await supabase
            .from('live_classes')
            .select(`
                *,
                course:courses(title)
            `)
            .eq('course_id', courseId)
            .order('scheduled_at', { ascending: true });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ liveClasses: liveClasses || [] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET ALL UPCOMING LIVE CLASSES FOR STUDENT
router.get('/upcoming', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can view' });
        }

        // Get enrolled courses
        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('course_id')
            .eq('student_id', req.user.id);

        const courseIds = enrollments?.map(e => e.course_id) || [];

        const { data: liveClasses, error } = await supabase
            .from('live_classes')
            .select(`
                *,
                course:courses(title)
            `)
            .in('course_id', courseIds)
            .gte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ liveClasses: liveClasses || [] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
