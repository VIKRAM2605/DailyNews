import db from '../../utils/db.js';
import bcrypt from 'bcryptjs';

// Get all users with pagination (admin only)
export const getAllUsers = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    // Get total count
    const [countResult] = await db`
      SELECT COUNT(*) as total FROM login
    `;
    const total = parseInt(countResult.total);

    // Get paginated users
    const users = await db`
      SELECT 
        id,
        name,
        email,
        role,
        has_approved,
        google_id,
        created_at,
        updated_at
      FROM login
      ORDER BY created_at DESC
      LIMIT ${parsedLimit}
      OFFSET ${parsedOffset}
    `;

    res.json({
      success: true,
      users,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < total
      }
    });
  } catch (error) {
    console.error('❌ Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
};

// Get pending users with pagination (not approved)
export const getPendingUsers = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const parsedLimit = parseInt(limit);
    const parsedOffset = parseInt(offset);

    // Get total count
    const [countResult] = await db`
      SELECT COUNT(*) as total FROM login WHERE has_approved = false
    `;
    const total = parseInt(countResult.total);

    // Get paginated pending users
    const users = await db`
      SELECT 
        id,
        name,
        email,
        role,
        google_id,
        created_at
      FROM login
      WHERE has_approved = false
      ORDER BY created_at DESC
      LIMIT ${parsedLimit}
      OFFSET ${parsedOffset}
    `;

    res.json({
      success: true,
      users,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
        hasMore: parsedOffset + parsedLimit < total
      }
    });
  } catch (error) {
    console.error('❌ Get pending users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending users'
    });
  }
};

// Get single user
export const getUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await db`
      SELECT 
        id,
        name,
        email,
        role,
        has_approved,
        google_id,
        created_at,
        updated_at
      FROM login
      WHERE id = ${userId}
      LIMIT 1
    `;

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user[0]
    });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
};

// Approve user
export const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const updated = await db`
      UPDATE login
      SET has_approved = true
      WHERE id = ${userId}
      RETURNING id, name, email, role, has_approved
    `;

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: updated[0],
      message: 'User approved successfully'
    });
  } catch (error) {
    console.error('❌ Approve user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve user'
    });
  }
};

// Reject/Delete user
export const rejectUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const deleted = await db`
      DELETE FROM login
      WHERE id = ${userId}
      RETURNING id, name, email
    `;

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: deleted[0],
      message: 'User rejected and removed successfully'
    });
  } catch (error) {
    console.error('❌ Reject user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject user'
    });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'faculty'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Valid role is required (admin or faculty)'
      });
    }

    const updated = await db`
      UPDATE login
      SET role = ${role}
      WHERE id = ${userId}
      RETURNING id, name, email, role, has_approved
    `;

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: updated[0],
      message: 'User role updated successfully'
    });
  } catch (error) {
    console.error('❌ Update user role error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role'
    });
  }
};

// Create manual user (admin creates account)
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required'
      });
    }

    // Check if email already exists
    const existing = await db`
      SELECT id FROM login
      WHERE email = ${email}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await db`
      INSERT INTO login (
        name,
        email,
        password,
        role,
        has_approved
      )
      VALUES (
        ${name},
        ${email},
        ${hashedPassword},
        ${role || 'faculty'},
        true
      )
      RETURNING id, name, email, role, has_approved, created_at
    `;

    res.json({
      success: true,
      user: newUser[0],
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('❌ Create user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const deleted = await db`
      DELETE FROM login
      WHERE id = ${userId}
      RETURNING id, name, email
    `;

    if (deleted.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: deleted[0],
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
};
