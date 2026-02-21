const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../utils/db');

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// REGISTER
router.post('/register', async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;
        if (!full_name || !email || !password || !role) 
            return res.status(400).json({ message: 'All fields are required' });

        // Check existing user
        const { data: existingUsers } = await supabase
            .from('users')
            .select('*')
            .eq('email', email);

        if (existingUsers && existingUsers.length > 0) return res.status(400).json({ message: 'Email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data, error } = await supabase
            .from('users')
            .insert([{ full_name, email, password: hashedPassword, role }]);

        if (error) return res.status(500).json({ message: error.message });

        res.json({ message: 'User registered successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: 'All fields are required' });

        const { data: users } = await supabase
            .from('users')
            .select('*')
            .eq('email', email);

        const user = users && users.length > 0 ? users[0] : null;

        if (!user) return res.status(400).json({ message: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

        res.json({ token, user: { id: user.id, full_name: user.full_name, role: user.role } });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
