import { Navigate, Outlet } from 'react-router-dom';

const PrivateRoute = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  console.log('PrivateRoute - User:', user);
  
  // If no user, redirect to login
  if (!user) {
    console.log('No user found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  console.log('User authenticated, rendering protected route');
  // If authenticated, render child routes
  return <Outlet />;
};

export default PrivateRoute;
