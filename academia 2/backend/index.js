const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const attendanceRoutes = require('./routes/attendance');
const assignmentsRoutes = require('./routes/assignments');
const gradesRoutes = require('./routes/grades');
const gamificationRoutes = require('./routes/gamification');
const guardianRoutes = require('./routes/guardian');
const adminRoutes = require('./routes/admin');


const app = express();

app.use(cors());
app.use(express.json());

// Debug: Log current directory and paths
console.log('__dirname:', __dirname);
console.log('Current working directory:', process.cwd());
console.log('Attempting to serve static from:', path.join(__dirname, '../frontend'));
console.log('Absolute path:', path.resolve(__dirname, '../frontend'));

// Serve static files from frontend directory at root
app.use(express.static(path.join(process.cwd(), 'frontend')));

// Serve from academia 2/frontend for Render
app.use(express.static(path.join(process.cwd(), 'academia 2/frontend')));

// Live Classes Routes
const liveClassesRoutes = require('./routes/liveclasses');
app.use('/api/live-class', liveClassesRoutes);


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/guardian', guardianRoutes);
app.use('/api/admin', adminRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'ACADEMIA LMS Backend Running' });
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Serve attendance-scan-result.html directly
app.get('/attendance-scan-result.html', (req, res) => {
    console.log('Serving attendance-scan-result.html');
    res.sendFile(path.join(__dirname, '../frontend/attendance-scan-result.html'));
});

// Serve attendance-scan.html directly
app.get('/attendance-scan.html', (req, res) => {
    console.log('Serving attendance-scan.html');
    res.sendFile(path.join(__dirname, '../frontend/attendance-scan.html'));
});

// Serve attendance-form.html directly
app.get('/attendance-form.html', (req, res) => {
    console.log('Serving attendance-form.html');
    res.sendFile(path.join(__dirname, '../frontend/attendance-form.html'));
});

// Serve enroll-by-code.html directly
app.get('/enroll-by-code.html', (req, res) => {
    console.log('Serving enroll-by-code.html');
    res.sendFile(path.join(__dirname, '../frontend/enroll-by-code.html'));
});

// Catch-all handler: serve index.html for any non-API routes that aren't specific HTML files
app.use((req, res, next) => {
    // Only serve index.html for routes that don't look like API or specific pages
    if (!req.path.startsWith('/api') && !req.path.endsWith('.html') && !req.path.includes('.')) {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    } else if (req.path.endsWith('.html')) {
        // For other HTML files, try to serve them
        const filePath = path.join(__dirname, '../frontend', req.path);
        res.sendFile(filePath, (err) => {
            if (err) {
                console.log('File not found:', req.path);
                res.status(404).send('File not found');
            }
        });
    } else {
        next();
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
