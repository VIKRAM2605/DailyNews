import express from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { register, login, logout } from '../controllers/auth/loginAuth.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected route example
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed`,
    session: false 
  }),
  async (req, res) => {
    try {
      console.log('🔐 Google OAuth callback triggered');
      console.log('👤 User from Google:', req.user);

      // Check if user is approved
      if (!req.user.has_approved) {
        console.log('⏳ User not approved');
        return res.redirect(
          `${process.env.FRONTEND_URL}/login?error=pending_approval`
        );
      }

      // Generate JWT
      const token = jwt.sign(
        { 
          id: req.user.id, 
          email: req.user.email, 
          role: req.user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      const userData = {
        id: req.user.id,
        username: req.user.name,
        email: req.user.email,
        role: req.user.role
      };

      console.log('✅ Token generated');
      console.log('🎫 Token preview:', token.substring(0, 50) + '...');
      console.log('📦 User data:', userData);

      // ✅ Redirect to frontend callback with token and user
      const userParam = encodeURIComponent(JSON.stringify(userData));
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/google/callback?token=${token}&user=${userParam}`;
      
      console.log('📍 Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('❌ Google callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  }
);

// Google OAuth failure route
router.get('/google/failure', (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/login?error=google_auth_failed`);
});

export default router;
