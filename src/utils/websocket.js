import { io } from 'socket.io-client';

// Single shared WebSocket connections
let pumpfunSocket = null;
let backendSocket = null;

export const getPumpfunSocket = () => {
  if (!pumpfunSocket) {
    console.log('🔌 Creating SINGLE PumpFun WebSocket connection...');
    pumpfunSocket = io('wss://ws.dev.fun/app-834546a696ba7c294d95');
    
    // Add connection event listeners for debugging
    pumpfunSocket.on('connect', () => {
      console.log('✅ PumpFun WebSocket connected successfully');
    });
    
    pumpfunSocket.on('disconnect', (reason) => {
      console.log('❌ PumpFun WebSocket disconnected:', reason);
    });
    
    pumpfunSocket.on('connect_error', (error) => {
      console.error('❌ PumpFun WebSocket connection error:', error);
    });
    
    // Listen for all events to debug
    pumpfunSocket.onAny((eventName, ...args) => {
      console.log('🔍 PumpFun WebSocket event:', eventName, args);
      
      // Check if this might be a message event with a different name
      if (eventName.includes('message') || eventName.includes('chat') || eventName.includes('pump')) {
        console.log('🎯 Potential message event detected:', eventName, args);
      }
    });
  }
  return pumpfunSocket;
};

export const getBackendSocket = () => {
  // Backend Socket.IO is disabled for now since we don't have a backend server
  // This prevents 404 errors in the console
  console.log('🔌 Backend Socket.IO is disabled (no backend server)');
  return null;
};

export const disconnectPumpfunSocket = () => {
  if (pumpfunSocket) {
    console.log('🔌 Disconnecting PumpFun WebSocket...');
    pumpfunSocket.disconnect();
    pumpfunSocket = null;
  }
};

export const disconnectBackendSocket = () => {
  // Backend Socket.IO is disabled for now
  console.log('🔌 Backend Socket.IO is disabled (no backend server)');
};
