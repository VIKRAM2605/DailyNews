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
    failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=google_auth_failed`,
    session: false 
  }),
  async (req, res) => {
    try {
      // Check if user is approved
      if (!req.user.has_approved) {
        return res.redirect(
          `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=pending_approval`
        );
      }

      // Generate JWT for Google user
      const token = jwt.sign(
        { 
          id: req.user.id, 
          email: req.user.email, 
          role: req.user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Set cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: parseInt(process.env.COOKIE_EXPIRES_DAYS || 7) * 24 * 60 * 60 * 1000
      });

      // Store user in localStorage via redirect with token
      const userData = encodeURIComponent(JSON.stringify({
        id: req.user.id,
        username: req.user.name,
        email: req.user.email,
        role: req.user.role
      }));

      // Redirect to dashboard with user data
      res.redirect(
        `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/callback?user=${userData}`
      );
    } catch (error) {
      console.error('Google callback error:', error);
      res.redirect(
        `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_failed`
      );
    }
  }
);

// Google OAuth failure route
router.get('/google/failure', (req, res) => {
  res.redirect(
    `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=google_auth_failed`
  );
});

export default router;
