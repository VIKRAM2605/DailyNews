import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import db from '../utils/db.js';

// Remove dotenv.config() from here - it should be in server.js only

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const rows = await db`
      SELECT id, name, email, role, has_approved 
      FROM login 
      WHERE id = ${id}
    `;
    done(null, rows[0]);
  } catch (error) {
    done(error, null);
  }
});

// Debug: Check if environment variables are loaded
console.log('🔑 Google Client ID:', process.env.GOOGLE_CLIENT_ID ? '✓ Loaded' : '✗ Missing');
console.log('🔑 Google Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? '✓ Loaded' : '✗ Missing');
console.log('🔑 Callback URL:', process.env.GOOGLE_CALLBACK_URL || 'Using default');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:8000/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists
        const existingUser = await db`
          SELECT * FROM login 
          WHERE email = ${profile.emails[0].value}
        `;

        if (existingUser.length > 0) {
          const user = existingUser[0];
          
          // Update google_id if not set
          if (!user.google_id) {
            await db`
              UPDATE login 
              SET google_id = ${profile.id}
              WHERE id = ${user.id}
            `;
          }
          
          // Check if approved
          if (!user.has_approved) {
            return done(null, false, { 
              message: 'Your account is pending approval.' 
            });
          }
          
          return done(null, user);
        }

        // Create new user with Google OAuth
        const newUser = await db`
          INSERT INTO login (name, email, google_id, role, has_approved)
          VALUES (
            ${profile.displayName}, 
            ${profile.emails[0].value}, 
            ${profile.id}, 
            'faculty'::role,
            false
          )
          RETURNING id, name, email, role, has_approved, google_id
        `;

        done(null, newUser[0]);
      } catch (error) {
        console.error('Google Strategy Error:', error);
        done(error, null);
      }
    }
  )
);

export default passport;
