const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../utils/db');

// Auth middleware (reuse from other routes)
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// 1. POST /api/assignments - Teacher creates assignment
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can create assignments' });
    }

    const { course_id, title, description, due_date, file_url } = req.body;

    // Validate UUID
    if (!uuidv4.validate(course_id)) {
      return res.status(400).json({ message: 'Invalid course_id UUID' });
    }

    // Verify teacher owns course
    const { data: course, error: courseErr } = await supabase
      .from('courses')
      .select('teacher_id')
      .eq('id', course_id)
      .single();

    if (courseErr || !course || course.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized for this course' });
    }

    const { data, error } = await supabase
      .from('assignments')
      .insert([{
        course_id,
        teacher_id: req.user.id,
        title,
        description: description || '',
        due_date,
        file_url: file_url || null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Assignment insert error:', error);
      return res.status(500).json({ message: error.message });
    }

    res.status(201).json({ message: 'Assignment created', assignment: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 2. GET /api/assignments/course/:courseId - Assignments for course
router.get('/course/:courseId', authMiddleware, async (req, res) => {
  try {
    const courseId = req.params.courseId;

    if (!uuidv4.validate(courseId)) {
      return res.status(400).json({ message: 'Invalid courseId UUID' });
    }

    let hasAccess = false;

    // Students enrolled, teachers own course
    if (req.user.role === 'student') {
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('student_id', req.user.id)
        .single();
      hasAccess = !!enrollment;
    } else if (req.user.role === 'teacher') {
      const { data: course } = await supabase
        .from('courses')
        .select('teacher_id')
        .eq('id', courseId)
        .single();
      hasAccess = course && course.teacher_id === req.user.id;
    } else {
      hasAccess = req.user.role === 'admin';
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Not authorized for this course' });
    }

    const { data: assignments, error } = await supabase
      .from('assignments')
      .select(`
        *,
        course:title
      `)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    res.json({ assignments: assignments || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 3. POST /api/submissions - Student submits
router.post('/submissions', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can submit' });
    }

    const { assignment_id, file_url } = req.body;

    if (!uuidv4.validate(assignment_id)) {
      return res.status(400).json({ message: 'Invalid assignment_id' });
    }

    // Check enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', (await supabase.from('assignments').select('course_id').eq('id', assignment_id).single()).data.course_id)
      .eq('student_id', req.user.id)
      .single();

    if (!enrollment) {
      return res.status(403).json({ message: 'Must be enrolled to submit' });
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('assignment_id', assignment_id)
      .eq('student_id', req.user.id)
      .single();

    if (existing) {
      return res.status(400).json({ message: 'Already submitted - re-upload or contact teacher' });
    }

    const { data, error } = await supabase
      .from('submissions')
      .insert([{
        assignment_id,
        student_id: req.user.id,
        file_url,
        submitted_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    res.status(201).json({ message: 'Submission successful', submission: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 4. GET /api/submissions/assignment/:id - Teacher view submissions
router.get('/submissions/assignment/:assignmentId', authMiddleware, async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;

    if (!uuidv4.validate(assignmentId)) {
      return res.status(400).json({ message: 'Invalid assignmentId' });
    }

    // Check teacher owns assignment
    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id')
      .eq('id', assignmentId)
      .single();

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const { data: course } = await supabase
      .from('courses')
      .select('teacher_id')
      .eq('id', assignment.course_id)
      .single();

    if (req.user.role !== 'teacher' || course.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { data: submissions, error } = await supabase
      .from('submissions')
      .select(`
        *,
        student:users(full_name, email)
      `)
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    res.json({ submissions: submissions || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// 5. PATCH /api/submissions/:id - Teacher grades
router.patch('/submissions/:submissionId', authMiddleware, async (req, res) => {
  try {
    const submissionId = req.params.submissionId;
    const { grade, feedback } = req.body;

    if (!uuidv4.validate(submissionId)) {
      return res.status(400).json({ message: 'Invalid submissionId' });
    }

    // Check teacher owns submission's assignment
    const { data: submission } = await supabase
      .from('submissions')
      .select('assignment_id')
      .eq('id', submissionId)
      .single();

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const { data: assignment } = await supabase
      .from('assignments')
      .select('course_id, teacher_id')
      .eq('id', submission.assignment_id)
      .single();

    if (req.user.role !== 'teacher' || assignment.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updateData = {
      grade,
      feedback
    };

    const { data, error } = await supabase
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    res.json({ message: 'Grade updated', submission: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
