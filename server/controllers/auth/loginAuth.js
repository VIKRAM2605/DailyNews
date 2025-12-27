import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../src/utils/db.js';
import dotenv from 'dotenv';

dotenv.config();

// Register new user
export const register = async (req, res) => {
  try {
    const { username, email, password, role = 'faculty' } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await db`
      SELECT email FROM login 
      WHERE email = ${email}
    `;

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user with has_approved = false by default
    const newUser = await db`
      INSERT INTO login (name, email, password, role, has_approved)
      VALUES (${username}, ${email}, ${hashedPassword}, ${role}::role, false)
      RETURNING id, name, email, role, has_approved, created_at
    `;

    if (newUser.length === 0) {
      throw new Error('Failed to create user');
    }

    const user = newUser[0];

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please wait for admin approval.',
      user: {
        id: user.id,
        username: user.name,
        email: user.email,
        role: user.role,
        has_approved: user.has_approved
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    // Find user
    const rows = await db`
      SELECT * FROM login 
      WHERE email = ${email}
    `;

    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = rows[0];

    // Check if account is approved
    if (!user.has_approved) {
      return res.status(403).json({ 
        success: false, 
        error: 'Your account is pending approval. Please contact an administrator.' 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // JWT payload
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    // Generate JWT
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: parseInt(process.env.COOKIE_EXPIRES_DAYS) * 24 * 60 * 60 * 1000
    });

    // Send user info
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
};

// Logout user
export const logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ success: true, message: 'Logout successful' });
};

// Get current user
export const getCurrentUser = async (req, res) => {
  try {
    const rows = await db`
      SELECT id, name, email, role, created_at 
      FROM login 
      WHERE id = ${req.user.id}
    `;

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.status(200).json({ 
      success: true, 
      user: rows[0] 
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
};
