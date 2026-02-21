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

// Serve static files from frontend directory at root
app.use(express.static(path.join(__dirname, '../frontend')));

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
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
