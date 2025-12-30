import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from './config/passport.js';
import cron from 'node-cron';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { Server } from 'socket.io';

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

// ✅ Create HTTP server and Socket.IO
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// ✅ Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // ✅ Handle joining card room
  socket.on('join-card', ({ cardId, userId, userName }) => {
    const roomName = `card-${cardId}`;
    socket.join(roomName);
    
    console.log(`👤 ${userName} (${userId}) joined ${roomName}`);
    
    // ✅ Get current room size
    const room = io.sockets.adapter.rooms.get(roomName);
    const roomSize = room ? room.size : 1;
    
    console.log(`📊 Room ${roomName} now has ${roomSize} users`);
    
    // ✅ Broadcast count to ALL users in room (including the joiner)
    io.to(roomName).emit('room-user-count', {
      count: roomSize
    });
    
    // ✅ Notify others (excluding joiner) about new user
    socket.to(roomName).emit('user-joined', {
      userId,
      userName,
      count: roomSize
    });
  });

  // ✅ Handle field updates
  socket.on('field-updated', ({ cardId, fieldName, value, userId, userName }) => {
    const roomName = `card-${cardId}`;
    console.log(`📝 ${userName} updated ${fieldName} in ${roomName}`);
    
    // Broadcast to others in the same room (not including sender)
    socket.to(roomName).emit('field-updated', {
      fieldName,
      value,
      userId,
      userName
    });
  });

  // ✅ Handle disconnection
  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    
    // Get all rooms this socket was in (filter out default room which is socket.id)
    const rooms = Array.from(socket.rooms).filter(room => room !== socket.id && room.startsWith('card-'));
    
    rooms.forEach(roomName => {
      const room = io.sockets.adapter.rooms.get(roomName);
      const roomSize = room ? room.size : 0;
      
      console.log(`📊 Room ${roomName} now has ${roomSize} users after disconnect`);
      
      // ✅ Update count for remaining users
      io.to(roomName).emit('room-user-count', {
        count: roomSize
      });
      
      // ✅ Notify others user left
      io.to(roomName).emit('user-left', {
        count: roomSize
      });
    });
  });
});

// Routes
app.use('/api/auth', loginRoutes);
app.use('/api/daily-card', dailyCardRoutes);
app.use('/api/field-metadata', fieldMetadataRoutes);
app.use('/api/users', userRoutes);
app.use('/api/faculty/daily-card', facultyDailyCardDetailsCreationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    socketConnections: io.engine.clientsCount
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
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready on ws://localhost:${PORT}`);
  console.log(`📡 Socket.IO path: /socket.io/`);
});

export { io };
