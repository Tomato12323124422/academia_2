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

// CREATE COURSE (Teacher only)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can create courses' });
        }

        const { title, description, category, duration } = req.body;
        
        if (!title || !description) {
            return res.status(400).json({ message: 'Title and description are required' });
        }

        const { data, error } = await supabase
            .from('courses')
            .insert([{
                title,
                description,
                category: category || 'General',
                duration: duration || 'Not specified',
                teacher_id: req.user.id,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.status(201).json({ 
            message: 'Course created successfully', 
            course: data[0] 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET ALL COURSES
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ courses: data });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET TEACHER'S COURSES
router.get('/my-courses', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .eq('teacher_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ courses: data });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET SPECIFIC COURSE
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .eq('id', req.params.id);

        if (error || !data || data.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }

        res.json({ course: data[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ENROLL IN COURSE (Student only)
router.post('/:id/enroll', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can enroll' });
        }

        const { data: existingEnrollment, error: checkError } = await supabase
            .from('enrollments')
            .select('*')
            .eq('course_id', req.params.id)
            .eq('student_id', req.user.id);

        if (existingEnrollment && existingEnrollment.length > 0) {
            return res.status(400).json({ message: 'Already enrolled in this course' });
        }

        const { data, error } = await supabase
            .from('enrollments')
            .insert([{
                course_id: req.params.id,
                student_id: req.user.id,
                enrolled_at: new Date().toISOString()
            }]);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ message: 'Enrolled successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET COURSE ENROLLMENTS (Teacher only)
router.get('/:id/enrollments', authMiddleware, async (req, res) => {
    try {
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .eq('id', req.params.id);

        if (courseError || !course || course.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }

        if (course[0].teacher_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { data, error } = await supabase
            .from('enrollments')
            .select(`
                *,
                student:users(id, full_name, email)
            `)
            .eq('course_id', req.params.id);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ enrollments: data });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
