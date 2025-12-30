import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor with debugging
api.interceptors.request.use(
  (config) => {
    console.log('\n' + '='.repeat(60));
    console.log('📡 AXIOS REQUEST');
    console.log('='.repeat(60));
    console.log('Method:', config.method?.toUpperCase());
    console.log('URL:', config.baseURL + config.url);
    console.log('Headers:', config.headers);
    
    const token = localStorage.getItem('token');
    console.log('🔑 Token from localStorage:', token ? 'Found' : 'Not found');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Token added to Authorization header');
      console.log('🎫 Token preview:', token.substring(0, 50) + '...');
    } else {
      console.log('⚠️ No token found in localStorage');
    }
    
    if (config.data) {
      console.log('📦 Request body:', config.data);
    }
    
    console.log('='.repeat(60) + '\n');
    
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with debugging
api.interceptors.response.use(
  (response) => {
    console.log('\n' + '='.repeat(60));
    console.log('📥 AXIOS RESPONSE');
    console.log('='.repeat(60));
    console.log('Status:', response.status, response.statusText);
    console.log('URL:', response.config.url);
    console.log('Data:', response.data);
    console.log('='.repeat(60) + '\n');
    
    return response;
  },
  (error) => {
    console.error('\n' + '='.repeat(60));
    console.error('❌ AXIOS RESPONSE ERROR');
    console.error('='.repeat(60));
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received');
      console.error('Request:', error.request);
    } else {
      console.error('Request setup error:', error.message);
    }
    console.error('='.repeat(60) + '\n');

    // Handle unauthorized or forbidden errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('🚪 Unauthorized - Clearing localStorage and redirecting to login');
      
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default api;
