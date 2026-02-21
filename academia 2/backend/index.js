const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const attendanceRoutes = require('./routes/attendance');
const assignmentsRoutes = require('./routes/assignments');
const gradesRoutes = require('./routes/grades');

const app = express();

app.use(cors());
app.use(express.json());

// Debug: Log current directory and paths
console.log('__dirname:', __dirname);
console.log('Current working directory:', process.cwd());
console.log('Attempting to serve static from:', path.join(__dirname, '../frontend'));
console.log('Absolute path:', path.resolve(__dirname, '../frontend'));

// Serve static files from frontend directory at root
app.use(express.static(path.join(__dirname, '../frontend')));

// Also try serving from current working directory as fallback
app.use(express.static(path.join(process.cwd(), 'frontend')));


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/grades', gradesRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'ACADEMIA LMS Backend Running' });
});

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Catch-all handler: serve index.html for any non-API routes (client-side routing)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});


// Debug: Log PORT configuration
console.log('PORT from env:', process.env.PORT);
console.log('Using PORT:', process.env.PORT || 5000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
