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

// CREATE ASSIGNMENT (Teacher only)
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can create assignments' });
        }

        const { course_id, title, description, due_date, points } = req.body;
        
        if (!course_id || !title || !description) {
            return res.status(400).json({ message: 'Course, title, and description are required' });
        }

        // Verify teacher owns the course
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .eq('id', course_id);

        if (courseError || !course || course.length === 0) {
            return res.status(404).json({ message: 'Course not found' });
        }

        if (course[0].teacher_id !== req.user.id) {
            return res.status(403).json({ message: 'You can only create assignments for your own courses' });
        }

        const { data, error } = await supabase
            .from('assignments')
            .insert([{
                course_id,
                title,
                description,
                due_date: due_date || null,
                points: points || 100,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.status(201).json({ 
            message: 'Assignment created successfully', 
            assignment: data[0] 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET ASSIGNMENTS FOR A COURSE
router.get('/course/:courseId', authMiddleware, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('assignments')
            .select('*')
            .eq('course_id', req.params.courseId)
            .order('due_date', { ascending: true });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ assignments: data });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET ALL ASSIGNMENTS FOR STUDENT (enrolled courses)
router.get('/my-assignments', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can access this' });
        }

        // Get student's enrolled courses
        const { data: enrollments, error: enrollError } = await supabase
            .from('enrollments')
            .select('course_id')
            .eq('student_id', req.user.id);

        if (enrollError) {
            return res.status(500).json({ message: enrollError.message });
        }

        const courseIds = enrollments.map(e => e.course_id);

        if (courseIds.length === 0) {
            return res.json({ assignments: [] });
        }

        // Get assignments for enrolled courses
        const { data: assignments, error } = await supabase
            .from('assignments')
            .select('*, course:courses(title, category)')
            .in('course_id', courseIds)
            .order('due_date', { ascending: true });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        // Get submission status for each assignment
        const assignmentsWithStatus = await Promise.all(
            (assignments || []).map(async (assignment) => {
                const { data: submission } = await supabase
                    .from('submissions')
                    .select('*')
                    .eq('assignment_id', assignment.id)
                    .eq('student_id', req.user.id)
                    .single();

                return {
                    ...assignment,
                    submitted: !!submission,
                    submission_id: submission?.id || null,
                    grade: submission?.grade || null,
                    feedback: submission?.feedback || null
                };
            })
        );

        res.json({ assignments: assignmentsWithStatus });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// SUBMIT ASSIGNMENT (Student only)
router.post('/:id/submit', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can submit assignments' });
        }

        const { content, file_url } = req.body;
        
        if (!content && !file_url) {
            return res.status(400).json({ message: 'Content or file is required' });
        }

        // Verify assignment exists
        const { data: assignment, error: assignError } = await supabase
            .from('assignments')
            .select('*, course:courses(*)')
            .eq('id', req.params.id)
            .single();

        if (assignError || !assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        // Check if student is enrolled in the course
        const { data: enrollment, error: enrollError } = await supabase
            .from('enrollments')
            .select('*')
            .eq('course_id', assignment.course_id)
            .eq('student_id', req.user.id)
            .single();

        if (enrollError || !enrollment) {
            return res.status(403).json({ message: 'You are not enrolled in this course' });
        }

        // Check if already submitted
        const { data: existing } = await supabase
            .from('submissions')
            .select('*')
            .eq('assignment_id', req.params.id)
            .eq('student_id', req.user.id);

        if (existing && existing.length > 0) {
            // Update existing submission
            const { data, error } = await supabase
                .from('submissions')
                .update({
                    content,
                    file_url: file_url || null,
                    submitted_at: new Date().toISOString()
                })
                .eq('assignment_id', req.params.id)
                .eq('student_id', req.user.id)
                .select();

            if (error) {
                return res.status(500).json({ message: error.message });
            }

            return res.json({ message: 'Assignment updated successfully', submission: data[0] });
        }

        // Create new submission
        const { data, error } = await supabase
            .from('submissions')
            .insert([{
                assignment_id: req.params.id,
                student_id: req.user.id,
                content,
                file_url: file_url || null,
                submitted_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.status(201).json({ message: 'Assignment submitted successfully', submission: data[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET SUBMISSIONS FOR AN ASSIGNMENT (Teacher only)
router.get('/:id/submissions', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can view submissions' });
        }

        // Verify teacher owns the assignment's course
        const { data: assignment, error: assignError } = await supabase
            .from('assignments')
            .select('*, course:courses(*)')
            .eq('id', req.params.id)
            .single();

        if (assignError || !assignment) {
            return res.status(404).json({ message: 'Assignment not found' });
        }

        if (assignment.course.teacher_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { data, error } = await supabase
            .from('submissions')
            .select('*, student:users(full_name, email)')
            .eq('assignment_id', req.params.id)
            .order('submitted_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ submissions: data });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GRADE SUBMISSION (Teacher only)
router.patch('/submissions/:submissionId/grade', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can grade submissions' });
        }

        const { grade, feedback } = req.body;

        if (grade === undefined) {
            return res.status(400).json({ message: 'Grade is required' });
        }

        // Verify submission exists and teacher owns the course
        const { data: submission, error: subError } = await supabase
            .from('submissions')
            .select('*, assignment:assignments(course:courses(teacher_id))')
            .eq('id', req.params.submissionId)
            .single();

        if (subError || !submission) {
            return res.status(404).json({ message: 'Submission not found' });
        }

        if (submission.assignment.course.teacher_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const { data, error } = await supabase
            .from('submissions')
            .update({
                grade,
                feedback: feedback || null,
                graded_at: new Date().toISOString()
            })
            .eq('id', req.params.submissionId)
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ message: 'Submission graded successfully', submission: data[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
