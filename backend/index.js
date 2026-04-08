const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const attendanceRoutes = require('./routes/attendance');
const assignmentsRoutes = require('./routes/assignments');
const gradesRoutes = require('./routes/grades');
const guardianRoutes = require('./routes/guardian');
const adminRoutes = require('./routes/admin');
const quizzesRoutes = require('./routes/quizzes');
const liveclassesRoutes = require('./routes/liveclasses');

const app = express();
app.set('trust proxy', 1); // Trust Render proxy

app.use(cors());
app.use(express.json());

// Debug logs
console.log('__dirname:', __dirname);
console.log('Current working directory:', process.cwd());
console.log('Attempting to serve static from:', path.join(__dirname, '../frontend'));
console.log('Absolute path:', path.resolve(__dirname, '../frontend'));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(process.cwd(), 'frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/guardian', guardianRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/live-classes', liveclassesRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'MASENO UNIVERSITY LMS Backend Running' });
});

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Serve specific HTML files directly
app.get('/attendance-scan-result.html', (req, res) => {
  console.log('Serving attendance-scan-result.html');
  res.sendFile(path.join(__dirname, '../frontend/attendance-scan-result.html'));
});

app.get('/attendance-scan.html', (req, res) => {
  console.log('Serving attendance-scan.html');
  res.sendFile(path.join(__dirname, '../frontend/attendance-scan.html'));
});

app.get('/attendance-form.html', (req, res) => {
  console.log('Serving attendance-form.html');
  res.sendFile(path.join(__dirname, '../frontend/attendance-form.html'));
});

app.get('/enroll-by-code.html', (req, res) => {
  console.log('Serving enroll-by-code.html');
  res.sendFile(path.join(__dirname, '../frontend/enroll-by-code.html'));
});

// Catch-all handler for non-API routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.endsWith('.html') && !req.path.includes('.')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  } else if (req.path.endsWith('.html')) {
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

// Re-import getServerIP to show helpful message
const os = require('os');
function getServerIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

app.listen(PORT, () => {
    console.log(`\n🚀 MASENO UNIVERSITY LMS Backend Started`);
    console.log(`📍 Local:   http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${getServerIP()}:${PORT}`);
    console.log(`\nStudents should be on the same Wi-Fi to scan QR codes locally.\n`);
});
