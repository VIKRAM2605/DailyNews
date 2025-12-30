import { Navigate, Outlet } from 'react-router-dom';

const PrivateRoute = () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  console.log('PrivateRoute - Token:', token ? 'Present' : 'Missing');
  console.log('PrivateRoute - User:', user);
  
  // ✅ Check BOTH token and user
  if (!token || !user) {
    console.log('No token or user found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Check if user role is faculty or admin
  const allowedRoles = ['faculty', 'admin'];
  if (!allowedRoles.includes(user.role)) {
    console.log('Unauthorized role:', user.role, '- redirecting to login');
    localStorage.removeItem('token'); // Clear invalid data
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  console.log('✅ User authenticated with valid role, rendering protected route');
  return <Outlet />;
};

export default PrivateRoute;
