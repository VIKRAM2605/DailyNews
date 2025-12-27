import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import api from '../utils/axios';

const Login = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        if (user) {
            navigate('/dashboard', { replace: true });
        }

        // Handle error messages from URL params
        const errorParam = searchParams.get('error');
        if (errorParam === 'pending_approval') {
            setError('Your account is pending admin approval. Please contact support.');
        } else if (errorParam === 'google_auth_failed') {
            setError('Google authentication failed. Please try again.');
        } else if (errorParam === 'auth_failed') {
            setError('Authentication failed. Please try again.');
        }
    }, [navigate, searchParams]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/auth/login', formData);

            if (response.data.success) {
                const userData = response.data.user;
                localStorage.setItem('user', JSON.stringify(userData));

                setTimeout(() => {
                    navigate('/dashboard', { replace: true });
                }, 100);
            } else {
                setError('Login failed. Please try again.');
            }
        } catch (err) {
            if (err.response?.status === 403) {
                setError('Your account is pending admin approval. Please wait or contact support.');
            } else {
                setError(
                    err.response?.data?.error ||
                    err.response?.data?.message ||
                    'Login failed. Please try again.'
                );
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        window.location.href = `${backendUrl}/api/auth/google`;
    };

    return (
        <div className="min-h-screen flex bg-white">
            {/* Left Side - Professional & Classic */}
            <div className="hidden lg:flex lg:w-1/2 relative">
                {/* Background Gradient */}
                <div className="absolute inset-0 bg-linear-to-br from-slate-900 via-blue-900 to-slate-900"></div>

                {/* Geometric Pattern Overlay */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.05) 35px, rgba(255,255,255,.05) 70px)`
                    }}></div>
                </div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-12 w-full">
                    {/* Logo/Brand */}
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2">DailyNews</h1>
                        <div className="w-16 h-1 bg-blue-400 rounded-full"></div>
                    </div>

                    {/* Center Quote */}
                    <div className="text-white flex flex-col items-center text-center">
                        {/* Row for SVG, left aligned inside a full-width container */}
                        <div className="w-full pl-16 flex justify-start">
                            <svg
                                className="w-16 h-16 text-blue-400 mb-6"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                            </svg>
                        </div>

                        {/* Centered text */}
                        <p className="text-3xl font-light leading-relaxed mb-6 text-white">
                            Welcome back. Your news awaits.
                        </p>
                        <p className="text-blue-200 text-lg font-light">
                            Continue where you left off.
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="text-slate-400 text-sm">
                        © 2025 DailyNews. All rights reserved.
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="lg:hidden text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">DailyNews</h1>
                        <div className="w-16 h-1 bg-blue-600 mx-auto rounded-full"></div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                            <p className="text-gray-600 text-sm">Sign in to continue</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full pl-11 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                                        placeholder="Enter your email"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="w-full pl-11 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors outline-none text-sm"
                                        placeholder="Enter your password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-slate-800 focus:ring-4 focus:ring-slate-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="w-4 h-4" />
                                        Sign In
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">Or continue with</span>
                            </div>
                        </div>

                        {/* Google Sign In Button */}
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 py-2.5 px-4 rounded-lg font-medium border-2 border-gray-300 hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 transition-all text-sm"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Sign in with Google
                        </button>

                        <div className="mt-6 text-center border-t border-gray-200 pt-6">
                            <p className="text-sm text-gray-600">
                                Don't have an account?{' '}
                                <a href="/register" className="font-semibold text-slate-900 hover:text-slate-700 transition-colors">
                                    Create account
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
