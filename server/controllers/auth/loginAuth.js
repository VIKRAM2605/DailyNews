import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../utils/db.js';
import dotenv from 'dotenv';

dotenv.config();

// Register new user
export const register = async (req, res) => {
  try {
    const { username, email, password, role = 'faculty' } = req.body;

    console.log('📝 Registration attempt:', { username, email, role });

    // Validation
    if (!username || !email || !password) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await db`
      SELECT email FROM login 
      WHERE email = ${email}
    `;

    if (existingUser.length > 0) {
      console.log('❌ Email already exists:', email);
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

    console.log('✅ User registered successfully:', { id: user.id, email: user.email });

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
    console.error('❌ Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
};

// ✅ LOGIN WITH FULL DEBUGGING
export const login = async (req, res) => {
  console.log('\n' + '='.repeat(60));
  console.log('🔐 LOGIN REQUEST RECEIVED');
  console.log('='.repeat(60));
  
  try {
    const { email, password } = req.body;

    console.log('📧 Email:', email);
    console.log('🔑 Password provided:', !!password);

    // Validation
    if (!email || !password) {
      console.log('❌ Missing credentials');
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    // Find user
    console.log('🔍 Searching for user in database...');
    const rows = await db`
      SELECT * FROM login 
      WHERE email = ${email}
    `;

    console.log('📊 Database query result:', rows.length, 'user(s) found');

    if (rows.length === 0) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const user = rows[0];
    console.log('✅ User found:');
    console.log('   - ID:', user.id);
    console.log('   - Name:', user.name);
    console.log('   - Email:', user.email);
    console.log('   - Role:', user.role);
    console.log('   - Approved:', user.has_approved);

    // Check if account is approved
    if (!user.has_approved) {
      console.log('⏳ User account not approved');
      return res.status(403).json({ 
        success: false, 
        error: 'Your account is pending approval. Please contact an administrator.' 
      });
    }

    // Verify password
    console.log('🔐 Verifying password...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔐 Password valid:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Invalid password');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    // JWT payload
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    console.log('📦 JWT Payload:', payload);

    // Check JWT_SECRET
    console.log('🔑 JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('🔑 JWT_SECRET length:', process.env.JWT_SECRET?.length);
    console.log('⏰ JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN || '7d');

    if (!process.env.JWT_SECRET) {
      console.error('❌ CRITICAL: JWT_SECRET not found in environment variables!');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
      });
    }

    // Generate JWT
    console.log('🎫 Generating JWT token...');
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    console.log('✅ Token generated successfully');
    console.log('🎫 Token length:', token.length);
    console.log('🎫 Token preview:', token.substring(0, 50) + '...');

    // Prepare response
    const responseData = {
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        username: user.name,
        email: user.email,
        role: user.role
      }
    };

    console.log('\n📤 RESPONSE DATA:');
    console.log('   - success:', responseData.success);
    console.log('   - message:', responseData.message);
    console.log('   - token exists:', !!responseData.token);
    console.log('   - token length:', responseData.token?.length);
    console.log('   - user:', responseData.user);

    console.log('\n✅ LOGIN SUCCESSFUL - Sending response...');
    console.log('='.repeat(60) + '\n');

    res.status(200).json(responseData);

  } catch (error) {
    console.error('\n❌ LOGIN ERROR:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.log('='.repeat(60) + '\n');
    
    res.status(500).json({ 
      success: false, 
      error: 'Login failed' 
    });
  }
};

// Logout user
export const logout = (req, res) => {
  console.log('👋 Logout request received');
  res.status(200).json({ success: true, message: 'Logout successful' });
};

// Get current user
export const getCurrentUser = async (req, res) => {
  try {
    console.log('👤 Get current user request for ID:', req.user.id);
    
    const rows = await db`
      SELECT id, name, email, role, created_at 
      FROM login 
      WHERE id = ${req.user.id}
    `;

    if (rows.length === 0) {
      console.log('❌ User not found:', req.user.id);
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    console.log('✅ User found:', rows[0]);

    res.status(200).json({ 
      success: true, 
      user: rows[0] 
    });
  } catch (error) {
    console.error('❌ Get current user error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
};
