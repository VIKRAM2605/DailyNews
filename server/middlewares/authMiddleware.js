import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  console.log('\n' + '='.repeat(60));
  console.log('🔐 AUTH MIDDLEWARE');
  console.log('='.repeat(60));
  
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    console.log('📋 Authorization header:', authHeader ? 'Present' : 'Missing');
    console.log('📋 Full header value:', authHeader);

    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    console.log('🎫 Extracted token:', token ? 'Found' : 'Not found');
    console.log('🎫 Token length:', token?.length);
    console.log('🎫 Token preview:', token ? token.substring(0, 50) + '...' : 'N/A');

    if (!token) {
      console.log('❌ No token provided');
      console.log('='.repeat(60) + '\n');
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    console.log('🔍 Verifying token...');
    console.log('🔑 JWT_SECRET exists:', !!process.env.JWT_SECRET);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        console.error('❌ JWT verification failed:');
        console.error('   - Error name:', err.name);
        console.error('   - Error message:', err.message);
        console.log('='.repeat(60) + '\n');
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }

      console.log('✅ Token verified successfully');
      console.log('👤 Decoded user:', {
        id: user.id,
        email: user.email,
        role: user.role
      });
      console.log('='.repeat(60) + '\n');

      req.user = user;
      next();
    });
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    console.log('='.repeat(60) + '\n');
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

export const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 ROLE AUTHORIZATION');
    console.log('='.repeat(60));
    
    if (!req.user) {
      console.log('❌ No user in request');
      console.log('='.repeat(60) + '\n');
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    console.log('👤 User role:', req.user.role);
    console.log('✅ Allowed roles:', allowedRoles);
    console.log('🔍 Role check:', allowedRoles.includes(req.user.role) ? 'PASS' : 'FAIL');

    if (!allowedRoles.includes(req.user.role)) {
      console.log('❌ Access denied for role:', req.user.role);
      console.log('='.repeat(60) + '\n');
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    console.log('✅ Role authorized:', req.user.role);
    console.log('='.repeat(60) + '\n');
    next();
  };
};
