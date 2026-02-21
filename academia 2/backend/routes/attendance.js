const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const supabase = require('../utils/db');
const os = require('os');

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Token rotation interval: 40 seconds (in milliseconds)
const TOKEN_INTERVAL = 40000;


// Get server IP address for QR codes
function getServerIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Use Render URL for production, fallback to local for development
const SERVER_URL = process.env.PUBLIC_URL || 'https://academia-2-xgdr.onrender.com';




// Generate rotating token based on current time
function generateToken() {
    return Math.floor(Date.now() / TOKEN_INTERVAL);
}

// Validate if a token is valid (current or previous interval)
function isValidToken(token) {
    const currentToken = generateToken();
    const tokenInt = parseInt(token);
    return tokenInt === currentToken || tokenInt === currentToken - 1;
}


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

// CREATE SESSION (Teacher only)
router.post('/sessions', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can create sessions' });
        }

        const { course_id, zoom_link } = req.body;
        
        if (!course_id) {
            return res.status(400).json({ message: 'Course ID is required' });
        }

        // Verify teacher owns this course
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('*')
            .eq('id', course_id)
            .eq('teacher_id', req.user.id);

        if (courseError || !course || course.length === 0) {
            return res.status(403).json({ message: 'You can only create sessions for your own courses' });
        }

        // Check if there's already an active session for this course
        const { data: activeSession, error: activeError } = await supabase
            .from('sessions')
            .select('*')
            .eq('course_id', course_id)
            .eq('status', 'active');

        if (activeSession && activeSession.length > 0) {
            return res.status(400).json({ message: 'There is already an active session for this course' });
        }

        const { data, error } = await supabase
            .from('sessions')
            .insert([{
                course_id,
                teacher_id: req.user.id,
                date: new Date().toISOString(),
                zoom_link: zoom_link || '',
                status: 'active',
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.status(201).json({ 
            message: 'Session created successfully', 
            session: data[0] 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET SESSION QR CODE (Dynamic with rotating token)
router.get('/sessions/:id/qr', authMiddleware, async (req, res) => {
    try {
        const { data: session, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', req.params.id)
            .eq('status', 'active');

        if (error || !session || session.length === 0) {
            return res.status(404).json({ message: 'Session not found or not active' });
        }

        // Only teacher who created the session can get QR
        if (session[0].teacher_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }


        // Generate dynamic QR code with rotating token
        // Point to frontend page where students will mark attendance
        const token = generateToken();
        const qrData = `${SERVER_URL}/frontend/attendance-scan-result.html?session=${req.params.id}&token=${token}`;
        const qrCodeDataUrl = await QRCode.toDataURL(qrData);


        res.json({ 
            qrCode: qrCodeDataUrl,
            sessionId: req.params.id,
            token: token,
            qrData: qrData,
            expiresIn: TOKEN_INTERVAL - (Date.now() % TOKEN_INTERVAL)
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET CURRENT TOKEN FOR SESSION (for frontend polling)
router.get('/sessions/:id/token', authMiddleware, async (req, res) => {
    try {
        const { data: session, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', req.params.id)
            .eq('status', 'active');

        if (error || !session || session.length === 0) {
            return res.status(404).json({ message: 'Session not found or not active' });
        }

        // Only teacher who created the session can get token
        if (session[0].teacher_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }


        const token = generateToken();
        const qrData = `${SERVER_URL}/api/attendance/scan?session=${req.params.id}&token=${token}`;


        res.json({ 
            sessionId: req.params.id,
            token: token,
            qrData: qrData,
            expiresIn: TOKEN_INTERVAL - (Date.now() % TOKEN_INTERVAL)
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// MARK ATTENDANCE (Student scans QR with token validation)
router.post('/attendance', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can mark attendance' });
        }

        const { session_id, token } = req.body;
        
        if (!session_id) {
            return res.status(400).json({ message: 'Session ID is required' });
        }

        if (!token) {
            return res.status(400).json({ message: 'Token is required. Please scan the current QR code.' });
        }

        // Validate the rotating token
        if (!isValidToken(token)) {
            return res.status(400).json({ 
                message: 'QR code has expired. Please scan the latest QR code displayed by your teacher.',
                expired: true 
            });
        }

        // Verify session exists and is active
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', session_id)
            .eq('status', 'active');

        if (sessionError || !session || session.length === 0) {
            return res.status(404).json({ message: 'Session not found or not active' });
        }

        // Check if already marked attendance
        const { data: existingAttendance, error: checkError } = await supabase
            .from('attendance')
            .select('*')
            .eq('session_id', session_id)
            .eq('student_id', req.user.id);

        if (existingAttendance && existingAttendance.length > 0) {
            return res.status(400).json({ message: 'Attendance already marked for this session' });
        }

        // Mark attendance
        const { data, error } = await supabase
            .from('attendance')
            .insert([{
                session_id,
                student_id: req.user.id,
                status: 'present',
                marked_at: new Date().toISOString()
            }]);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ 
            message: 'Attendance marked successfully',
            attendance: data
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// NEW: Register attendance via form (for QR scan fallback)
router.post('/attendance/register', async (req, res) => {
    try {
        const { name, regNo, sessionId, token } = req.body;
        
        if (!name || !regNo || !sessionId || !token) {
            return res.status(400).json({ message: 'All fields are required: name, regNo, sessionId, token' });
        }

        // Validate the rotating token
        if (!isValidToken(token)) {
            return res.status(400).json({ 
                message: 'QR code has expired. Please scan the latest QR code.',
                expired: true 
            });
        }

        // Verify session exists and is active
        const sessionIdInt = parseInt(sessionId);
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionIdInt)
            .eq('status', 'active');

        if (sessionError || !session || session.length === 0) {
            return res.status(404).json({ message: 'Session not found or not active' });
        }

        // Check for duplicate attendance (same regNo + session)
        const { data: existingAttendance, error: checkError } = await supabase
            .from('attendance')
            .select('*')
            .eq('session_id', sessionIdInt)
            .eq('reg_no', regNo);

        if (existingAttendance && existingAttendance.length > 0) {
            return res.status(400).json({ message: 'Attendance already marked for this session' });
        }

        // Mark attendance
        const { data, error } = await supabase
            .from('attendance')
            .insert([{
                session_id: sessionIdInt,
                name: name,
                reg_no: regNo,
                status: 'present',
                marked_at: new Date().toISOString()
            }]);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ 
            message: 'Attendance registered successfully',
            attendance: data
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET SESSION ATTENDANCE (Teacher only)
router.get('/sessions/:id/attendance', authMiddleware, async (req, res) => {
    try {
        // Get session details
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', req.params.id);

        if (sessionError || !session || session.length === 0) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Only teacher who created the session can view attendance
        if (session[0].teacher_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }


        // Get attendance records
        const { data: attendance, error } = await supabase
            .from('attendance')
            .select(`
                *,
                student:users(id, full_name, email)
            `)
            .eq('session_id', req.params.id)
            .order('marked_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ 
            session: session[0],
            attendance: attendance || [],
            count: attendance ? attendance.length : 0
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET COURSE SESSIONS
router.get('/courses/:id/sessions', authMiddleware, async (req, res) => {
    try {
        const { data: sessions, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('course_id', req.params.id)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ sessions: sessions || [] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// END SESSION (Teacher only)
router.patch('/sessions/:id/end', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'teacher') {
            return res.status(403).json({ message: 'Only teachers can end sessions' });
        }

        // Convert session ID to integer
        const sessionId = parseInt(req.params.id, 10);

        // First, check if session exists and is active
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('status', 'active');

        if (sessionError || !session || session.length === 0) {
            return res.status(404).json({ message: 'Active session not found' });
        }

        // Verify teacher owns this session
        if (session[0].teacher_id !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to end this session' });
        }

        // Update session status to ended
        const { data, error } = await supabase
            .from('sessions')
            .update({ status: 'ended' })
            .eq('id', sessionId)
            .select();

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ 
            message: 'Session ended successfully',
            session: data[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET STUDENT ATTENDANCE HISTORY
router.get('/my-attendance', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(403).json({ message: 'Only students can view their attendance' });
        }

        const { data: attendance, error } = await supabase
            .from('attendance')
            .select(`
                *,
                session:sessions(*, course:courses(title))
            `)
            .eq('student_id', req.user.id)
            .order('marked_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        res.json({ attendance: attendance || [] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// SCAN QR CODE - Student visits this URL from QR scan
router.get('/scan', async (req, res) => {
    try {
        const { session: sessionId, token } = req.query;
        
        if (!sessionId || !token) {
            return res.status(400).json({ message: 'Invalid QR code. Missing session or token.' });
        }
        
        // Validate token
        if (!isValidToken(token)) {
            return res.status(400).json({ 
                message: 'QR code has expired. Please scan the latest QR code.',
                expired: true 
            });
        }
        
        // Check if session exists and is active
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*, courses(title)')
            .eq('id', sessionId)
            .eq('status', 'active');
        
        if (sessionError || !session || session.length === 0) {
            return res.status(404).json({ message: 'Session not found or not active' });
        }
        
        // Return session info and token for attendance marking
        res.json({
            valid: true,
            sessionId: sessionId,
            token: token,
            course: session[0].courses?.title || 'Unknown Course',
            message: 'Ready to mark attendance'
        });
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// MARK ATTENDANCE VIA SCAN (after visiting scan URL)
router.post('/scan/mark', async (req, res) => {
    try {
        const { session_id, token, name, regNo, userId } = req.body;
        
        if (!session_id || !token) {
            return res.status(400).json({ message: 'Session ID and token are required' });
        }
        
        // Validate token
        if (!isValidToken(token)) {
            return res.status(400).json({ 
                message: 'QR code has expired. Please scan the latest QR code.',
                expired: true 
            });
        }
        
        // Check if session exists and is active
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', session_id)
            .eq('status', 'active');
        
        if (sessionError || !session || session.length === 0) {
            return res.status(404).json({ message: 'Session not found or not active' });
        }
        
        // If userId provided (logged in student)
        if (userId) {
            // Check if already marked
            const { data: existing } = await supabase
                .from('attendance')
                .select('*')
                .eq('session_id', session_id)
                .eq('student_id', userId);
            
            if (existing && existing.length > 0) {
                return res.status(400).json({ message: 'Attendance already marked' });
            }
            
            // Mark attendance with student_id
            const { data, error } = await supabase
                .from('attendance')
                .insert([{
                    session_id,
                    student_id: userId,
                    status: 'present',
                    marked_at: new Date().toISOString()
                }]);
            
            if (error) return res.status(500).json({ message: error.message });
            
            return res.json({ message: 'Attendance marked successfully!' });
        }
        
        // If name and regNo provided (manual entry)
        if (name && regNo) {
            // Check for duplicate
            const { data: existing } = await supabase
                .from('attendance')
                .select('*')
                .eq('session_id', session_id)
                .eq('reg_no', regNo);
            
            if (existing && existing.length > 0) {
                return res.status(400).json({ message: 'Attendance already marked' });
            }
            
            // Mark attendance with name and regNo
            const { data, error } = await supabase
                .from('attendance')
                .insert([{
                    session_id,
                    name: name,
                    reg_no: regNo,
                    status: 'present',
                    marked_at: new Date().toISOString()
                }]);
            
            if (error) return res.status(500).json({ message: error.message });
            
            return res.json({ message: 'Attendance marked successfully!' });
        }
        
        return res.status(400).json({ message: 'Either userId or name+regNo required' });
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
