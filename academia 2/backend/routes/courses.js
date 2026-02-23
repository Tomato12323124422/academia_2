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

// Generate unique course code
function generateCourseCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

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

        // Generate unique course code
        let courseCode = generateCourseCode();
        
        // Make sure course code is unique
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 10) {
            const { data: existing } = await supabase
                .from('courses')
                .select('id')
                .eq('course_code', courseCode);
            
            if (!existing || existing.length === 0) {
                isUnique = true;
            } else {
                courseCode = generateCourseCode();
            }
            attempts++;
        }

        const { data, error } = await supabase
            .from('courses')
            .insert([{
                title,
                description,
                category: category || 'General',
                duration: duration || 'Not specified',
                teacher_id: req.user.id,
                course_code: courseCode,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.status(201).json({ 
            message: 'Course created successfully', 
            course: data[0],
            courseCode: courseCode
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

// GET STUDENT'S ENROLLED COURSES
router.get('/enrolled', authMiddleware, async (req, res) => {
    try {
        // Get student's enrollments
        const { data: enrollments, error: enrollError } = await supabase
            .from('enrollments')
            .select('course_id')
            .eq('student_id', req.user.id);


        if (enrollError) {
            return res.status(500).json({ message: enrollError.message });
        }

        const courseIds = enrollments.map(e => e.course_id);

        if (courseIds.length === 0) {
            return res.json({ courses: [] });
        }

        // Get course details with teacher info
        const { data: courses, error } = await supabase
            .from('courses')
            .select('*')
            .in('id', courseIds)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ courses });


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
                student_id: req.user.id
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

// ENROLL BY COURSE CODE (Student only)
router.post('/enroll-by-code', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can enroll via course code' });
        }

        const { courseCode } = req.body;
        
        if (!courseCode) {
            return res.status(400).json({ message: 'Course code is required' });
        }

        // Find course by course code
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .eq('course_code', courseCode.toUpperCase());

        if (courseError) {
            return res.status(500).json({ message: courseError.message });
        }

        if (!course || course.length === 0) {
            return res.status(404).json({ message: 'Invalid course code. Please check and try again.' });
        }

        const courseData = course[0];

        // Check if already enrolled
        const { data: existingEnrollment, error: checkError } = await supabase
            .from('enrollments')
            .select('*')
            .eq('course_id', courseData.id)
            .eq('student_id', req.user.id);

        if (checkError) {
            return res.status(500).json({ message: checkError.message });
        }

        if (existingEnrollment && existingEnrollment.length > 0) {
            return res.status(400).json({ message: 'You are already enrolled in this course' });
        }

        // Enroll the student
        const { data, error } = await supabase
            .from('enrollments')
            .insert([{
                course_id: courseData.id,
                student_id: req.user.id
            }]);


        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ 
            message: 'Enrolled successfully!',
            course: {
                id: courseData.id,
                title: courseData.title,
                description: courseData.description,
                category: courseData.category
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET COURSE BY CODE (For preview before enrolling)
router.get('/by-code/:code', async (req, res) => {
    try {
        const { data: course, error } = await supabase
            .from('courses')
            .select('id, title, description, category, teacher_id, course_code')
            .eq('course_code', req.params.code.toUpperCase());

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        if (!course || course.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Get teacher name
        const { data: teacher } = await supabase
            .from('users')
            .select('full_name')
            .eq('id', course[0].teacher_id);

        res.json({ 
            course: {
                ...course[0],
                teacher_name: teacher?.[0]?.full_name || 'Unknown'
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// REGENERATE COURSE CODE (Teacher only)
router.post('/:id/regenerate-code', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can regenerate course codes' });
        }

        // Verify teacher owns this course
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .eq('id', req.params.id)
            .eq('teacher_id', req.user.id);

        if (courseError || !course || course.length === 0) {
            return res.status(404).json({ message: 'Course not found or not authorized' });
        }

        // Generate new unique course code
        let newCode = generateCourseCode();
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 10) {
            const { data: existing } = await supabase
                .from('courses')
                .select('id')
                .eq('course_code', newCode);
            
            if (!existing || existing.length === 0) {
                isUnique = true;
            } else {
                newCode = generateCourseCode();
            }
            attempts++;
        }

        // Update course with new code
        const { data, error } = await supabase
            .from('courses')
            .update({ course_code: newCode })
            .eq('id', req.params.id)
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ 
            message: 'Course code regenerated successfully',
            courseCode: newCode
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
