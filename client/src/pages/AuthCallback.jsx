import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const userParam = searchParams.get('user');
    
    if (userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        localStorage.setItem('user', JSON.stringify(userData));
        navigate('/dashboard', { replace: true });
      } catch (error) {
        console.error('Error parsing user data:', error);
        navigate('/login?error=auth_failed', { replace: true });
      }
    } else {
      navigate('/login?error=auth_failed', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
