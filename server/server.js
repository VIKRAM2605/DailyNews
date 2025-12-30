import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from './config/passport.js';
import cron from 'node-cron';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import loginRoutes from './routes/loginRoute.js';
import dailyCardRoutes from './routes/dailyCardRoutes.js';
import fieldMetadataRoutes from './routes/fieldMetadataRoutes.js';
import userRoutes from './routes/userRoutes.js';
import facultyDailyCardDetailsCreationRoutes from './routes/facultyDailyCardDetailsCreationRoutes.js';
import { autoGenerateCardGroup } from './controllers/dailyCard/dailyCardGroupAndCardsOfGroupController.js';

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('📁 Static files serving from:', path.join(__dirname, 'uploads'));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', loginRoutes);
app.use('/api/daily-card', dailyCardRoutes);
app.use('/api/field-metadata', fieldMetadataRoutes);
app.use('/api/users', userRoutes);  // ✅ Add this
app.use('/api/faculty/daily-card', facultyDailyCardDetailsCreationRoutes);
// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Cron job
cron.schedule('0 0 * * *', async () => {
  console.log('🕐 Running daily card group generation cron job...');
  await autoGenerateCardGroup();
}, {
  timezone: "Asia/Kolkata"
});

console.log('🔍 Checking today\'s card group on server start...');
autoGenerateCardGroup();

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL}`);
  console.log(`🔐 Google OAuth configured`);
  console.log(`⏰ Cron job scheduled: Daily at 00:00 IST`);
});
