const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const attendanceRoutes = require('./routes/attendance');

const app = express();


app.use(cors());
app.use(express.json());

// Serve static files from frontend directory
app.use('/frontend', express.static(path.join(__dirname, '../frontend')));

// Serve root index.html
app.get('/index', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/attendance', attendanceRoutes);

app.get('/', (req, res) => {


    res.send('ACADEMIA LMS Backend Running');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
