import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000';
      
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket connected:', this.socket.id);
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
      });

      this.socket.on('connect_error', (error) => {
        console.error('🔥 Socket connection error:', error);
      });
    }
    
    return this.socket;
  }

  // ✅ Join card room with proper user count handling
  joinCard(cardId, userId, userName) {
    if (!this.socket) {
      console.error('Socket not connected');
      return;
    }

    console.log(`🚀 Joining card room: ${cardId} as ${userName}`);
    
    this.socket.emit('join-card', {
      cardId,
      userId,
      userName
    });
  }

  // ✅ Listen for room user count updates
  onRoomUserCount(callback) {
    if (!this.socket) return;
    this.socket.on('room-user-count', callback);
  }

  // Emit field change
  emitFieldChange(cardId, fieldName, value, userId, userName) {
    if (!this.socket) return;
    
    this.socket.emit('field-updated', {
      cardId,
      fieldName,
      value,
      userId,
      userName
    });
  }

  // Listen for field updates
  onFieldUpdated(callback) {
    if (!this.socket) return;
    this.socket.on('field-updated', callback);
  }

  // Listen for user joined
  onUserJoined(callback) {
    if (!this.socket) return;
    this.socket.on('user-joined', callback);
  }

  // Listen for user left
  onUserLeft(callback) {
    if (!this.socket) return;
    this.socket.on('user-left', callback);
  }

  // Remove all listeners
  removeAllListeners() {
    if (!this.socket) return;
    this.socket.off('field-updated');
    this.socket.off('user-joined');
    this.socket.off('user-left');
    this.socket.off('room-user-count');
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SocketService();
