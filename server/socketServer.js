import { Server } from 'socket.io';
import db from './utils/db.js';

export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true
    }
  });

  // Store active users per card
  const cardRooms = new Map(); // cardId -> Set of socket IDs

  io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    // Join card room
    socket.on('join-card', async ({ cardId, userId, userName }) => {
      console.log(`👤 ${userName} joining card ${cardId}`);
      
      socket.join(`card-${cardId}`);
      
      // Track active users
      if (!cardRooms.has(cardId)) {
        cardRooms.set(cardId, new Set());
      }
      cardRooms.get(cardId).add(socket.id);
      
      socket.cardId = cardId;
      socket.userId = userId;
      socket.userName = userName;

      // Notify others
      socket.to(`card-${cardId}`).emit('user-joined', {
        userId,
        userName,
        socketId: socket.id
      });

      // Send list of active users
      const activeUsers = Array.from(cardRooms.get(cardId)).map(id => {
        const s = io.sockets.sockets.get(id);
        return s ? { userId: s.userId, userName: s.userName, socketId: id } : null;
      }).filter(Boolean);

      socket.emit('active-users', activeUsers);
    });

    // Field value changed
    socket.on('field-changed', ({ cardId, fieldName, value, userId, userName }) => {
      console.log(`📝 Field changed: ${fieldName} by ${userName}`);
      
      // Broadcast to all others in the room
      socket.to(`card-${cardId}`).emit('field-updated', {
        fieldName,
        value,
        userId,
        userName,
        timestamp: Date.now()
      });
    });

    // File uploaded
    socket.on('file-uploaded', ({ cardId, fieldName, fileUrl, userId, userName }) => {
      console.log(`📸 File uploaded: ${fieldName} by ${userName}`);
      
      socket.to(`card-${cardId}`).emit('file-added', {
        fieldName,
        fileUrl,
        userId,
        userName,
        timestamp: Date.now()
      });
    });

    // File removed
    socket.on('file-removed', ({ cardId, fieldName, fileUrl, userId, userName }) => {
      console.log(`🗑️ File removed: ${fieldName} by ${userName}`);
      
      socket.to(`card-${cardId}`).emit('file-deleted', {
        fieldName,
        fileUrl,
        userId,
        userName,
        timestamp: Date.now()
      });
    });

    // User is typing indicator
    socket.on('typing', ({ cardId, fieldName, userId, userName }) => {
      socket.to(`card-${cardId}`).emit('user-typing', {
        fieldName,
        userId,
        userName
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('❌ User disconnected:', socket.id);
      
      if (socket.cardId && cardRooms.has(socket.cardId)) {
        cardRooms.get(socket.cardId).delete(socket.id);
        
        // Notify others
        socket.to(`card-${socket.cardId}`).emit('user-left', {
          userId: socket.userId,
          userName: socket.userName,
          socketId: socket.id
        });

        // Clean up empty rooms
        if (cardRooms.get(socket.cardId).size === 0) {
          cardRooms.delete(socket.cardId);
        }
      }
    });
  });

  return io;
};
