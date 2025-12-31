import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header = () => {
    // Get user from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user?.role || 'faculty';

    // Get initials from username
    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    };

    // Get profile image or use initials
    const profileImage = user?.picture || user?.avatar || null;

    return (
        <header className="fixed top-0 right-0 left-16 h-16 bg-white border-b border-gray-200 shadow-sm z-30 flex items-center justify-between px-6">
            {/* Left - Brand Name */}
            <div className="flex items-center">
                <h1 className="text-3xl font-bold text-slate-900">
                    DailyNews<span className="text-blue-500">.</span>
                </h1>
            </div>


            {/* Right - Profile */}
            <button
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
                {/* Profile Image or Initials */}
                {profileImage ? (
                    <img
                        src={profileImage}
                        alt={user?.username || 'User'}
                        className="w-9 h-9 rounded-full object-cover border-2 border-gray-200"
                    />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm border-2 border-gray-200">
                        {getInitials(user?.username || user?.name)}
                    </div>
                )}

                {/* Username */}
                <div className="hidden md:block text-left">
                    <p className="text-sm font-semibold text-gray-900">
                        {user?.username || user?.name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500">{user?.email || 'user@example.com'}</p>
                </div>
            </button>
        </header>
    );
};

export default Header;
