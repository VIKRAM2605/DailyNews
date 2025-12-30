import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const GoogleCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 GOOGLE OAUTH CALLBACK');
    console.log('='.repeat(60));
    
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');

    console.log('🎫 Token received:', token ? 'YES ✅' : 'NO ❌');
    console.log('👤 User data received:', userParam ? 'YES ✅' : 'NO ❌');

    if (token && userParam) {
      try {
        const user = JSON.parse(decodeURIComponent(userParam));
        
        console.log('\n📦 Decoded User Data:');
        console.log('   - ID:', user.id);
        console.log('   - Username:', user.username);
        console.log('   - Email:', user.email);
        console.log('   - Role:', user.role);
        
        console.log('\n💾 Storing in localStorage...');
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        console.log('✅ Token stored:', !!localStorage.getItem('token'));
        console.log('✅ User stored:', !!localStorage.getItem('user'));

        // Redirect based on role
        let redirectPath = '/dashboard';
        
        if (user.role === 'admin') {
          redirectPath = '/admin/daily-cards';
          console.log('\n🎯 Redirecting to ADMIN dashboard');
        } else if (user.role === 'faculty') {
          redirectPath = '/faculty/daily-cards';
          console.log('\n🎯 Redirecting to FACULTY dashboard');
        } else {
          console.log('\n🎯 Redirecting to DEFAULT dashboard');
        }

        console.log('📍 Redirect path:', redirectPath);
        console.log('='.repeat(60) + '\n');
        
        navigate(redirectPath, { replace: true });

      } catch (error) {
        console.error('\n❌ ERROR processing callback:');
        console.error('Error:', error);
        console.log('='.repeat(60) + '\n');
        navigate('/login?error=auth_failed', { replace: true });
      }
    } else {
      console.error('\n❌ Missing token or user data!');
      console.log('='.repeat(60) + '\n');
      navigate('/login?error=auth_failed', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-indigo-600 to-purple-600">
      <div className="text-center text-white">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-2xl font-semibold mb-2">Authentication Successful!</h2>
        <p className="opacity-90">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
};

export default GoogleCallback;
