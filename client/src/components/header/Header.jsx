import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Listen for close events from Navbar
  useEffect(() => {
    const handleToggle = (event) => {
      setMobileMenuOpen(event.detail.isOpen);
    };
    
    window.addEventListener('toggleMobileMenu', handleToggle);
    
    return () => {
      window.removeEventListener('toggleMobileMenu', handleToggle);
    };
  }, []);
  
  // Get user from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');

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

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
    // Dispatch custom event to notify Navbar
    window.dispatchEvent(new CustomEvent('toggleMobileMenu', { 
      detail: { isOpen: !mobileMenuOpen } 
    }));
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-16 h-16 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-4 md:px-6" style={{ zIndex: 50 }}>
      {/* Left - Hamburger (mobile) + Brand Name */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger Button - Inside Header with higher z-index */}
        <button
          onClick={toggleMobileMenu}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 relative z-50"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5 text-slate-900" strokeWidth={2.5} />
          ) : (
            <Menu className="w-5 h-5 text-slate-900" strokeWidth={2.5} />
          )}
        </button>

        {/* Brand Name */}
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 select-none">
          DailyNews<span className="text-blue-500">.</span>
        </h1>
      </div>

      {/* Right - Profile */}
      <button
        className="flex items-center gap-2 md:gap-3 px-2 md:px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
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

        {/* Username - Hidden on small mobile screens */}
        <div className="hidden sm:block text-left">
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
