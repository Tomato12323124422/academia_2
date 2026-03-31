const express = require('express');
const router = express.Router();
const supabase = require('../utils/db');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

// UPLOAD ASSIGNMENT ATTACHMENT (Teacher)
router.post('/assignment/:id/attachment', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Only teachers can upload' });
    }

    const file = req.file;
    const assignmentId = req.params.id;

    // Verify teacher owns assignment
    const { data: assignment } = await supabase
      .from('assignments')
      .select('*, course:courses(teacher_id)')
      .eq('id', assignmentId)
      .single();

    if (!assignment || assignment.course.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Upload to Supabase Storage
    const fileExt = path.extname(file.originalname);
    const fileName = `assignments/${assignmentId}/${Date.now()}${fileExt}`;

    const { data, error } = await supabase.storage
      .from('assignments')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    // Update assignment with file URL
    const publicUrl = supabase.storage.from('assignments').getPublicUrl(data.path).data.publicUrl;
    
    const { error: updateError } = await supabase
      .from('assignments')
      .update({ attachment_url: publicUrl })
      .eq('id', assignmentId);

    if (updateError) {
      return res.status(500).json({ message: updateError.message });
    }

    res.json({ message: 'Attachment uploaded', url: publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// STUDENT SUBMISSION UPLOAD
router.post('/submission/:assignmentId', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can submit' });
    }

    const file = req.file;
    const { student_id, content } = req.body;
    const assignmentId = req.params.assignmentId;

    // Verify enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('*')
      .eq('course_id', (await supabase.from('assignments').select('course_id').eq('id', assignmentId)).data[0].course_id)
      .eq('student_id', req.user.id)
      .single();

    if (!enrollment) {
      return res.status(403).json({ message: 'Not enrolled' });
    }

    // Upload file
    const fileExt = path.extname(file.originalname);
    const fileName = `submissions/${assignmentId}/${req.user.id}/${Date.now()}${fileExt}`;

    const { data, error } = await supabase.storage
      .from('submissions')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype
      });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const publicUrl = supabase.storage.from('submissions').getPublicUrl(data.path).data.publicUrl;

    // Save submission
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .upsert({
        assignment_id: assignmentId,
        student_id: req.user.id,
        content,
        file_url: publicUrl,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (subError) {
      return res.status(500).json({ message: subError.message });
    }

    res.json({ message: 'Submission uploaded', submission });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
