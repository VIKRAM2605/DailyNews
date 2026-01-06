import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Newspaper, 
  Users, 
  FileText,
  LogOut,
} from 'lucide-react';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Listen for toggle events from Header
  useEffect(() => {
    const handleToggle = (event) => {
      setIsOpen(event.detail.isOpen);
    };
    
    window.addEventListener('toggleMobileMenu', handleToggle);
    
    return () => {
      window.removeEventListener('toggleMobileMenu', handleToggle);
    };
  }, []);
  
  // Get user from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = user?.role || 'faculty';

  // Faculty menu items - DAILY CARDS ONLY
  const facultyMenuItems = [
    { 
      name: 'Daily Cards', 
      icon: Newspaper, 
      path: '/faculty/daily-cards' 
    },
  ];

  // Admin menu items - ACTIVE ROUTES ONLY
  const adminMenuItems = [
    { 
      name: 'Daily Cards', 
      icon: Newspaper, 
      path: '/admin/daily-cards' 
    },
    { 
      name: 'Field Metadata', 
      icon: FileText, 
      path: '/admin/field-metadata' 
    },
    { 
      name: 'Users', 
      icon: Users, 
      path: '/admin/users' 
    },
  ];

  // Select menu based on role
  const menuItems = userRole === 'admin' ? adminMenuItems : facultyMenuItems;

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const closeMobileMenu = () => {
    setIsOpen(false);
    // Notify Header to update its state
    window.dispatchEvent(new CustomEvent('toggleMobileMenu', { 
      detail: { isOpen: false } 
    }));
  };

  return (
    <div
      className={`fixed left-0 top-0 h-screen w-64 md:w-16 bg-white border-r border-gray-200 shadow-lg md:shadow-sm flex flex-col overflow-hidden transition-transform duration-300 ease-in-out z-40 ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-start md:justify-center h-16 border-b border-gray-200 shrink-0 px-4 md:px-0">
        <div className="relative flex items-center gap-3">
          <Newspaper className="w-7 h-7 text-slate-900" strokeWidth={2} />
          <div className="absolute -bottom-1 left-5 md:left-0 md:-right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
          
          {/* Brand name visible only on mobile when menu is open */}
          <span className="md:hidden text-xl font-bold text-slate-900">
            DailyNews<span className="text-blue-500">.</span>
          </span>
        </div>
      </div>

      {/* Main Menu Items */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                `flex items-center md:justify-center h-12 px-4 md:px-0 relative group shrink-0 ${
                  isActive
                    ? 'text-blue-600 bg-blue-50 border-r-4 md:border-r-0 border-blue-600'
                    : 'text-gray-600 hover:text-slate-900 hover:bg-gray-50'
                } transition-all duration-200`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              
              {/* Text label visible on mobile */}
              <span className="md:hidden ml-4 font-medium text-sm">
                {item.name}
              </span>
              
              {/* Tooltip with Arrow - Desktop only */}
              <span 
                className="hidden md:block fixed px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg"
                style={{ 
                  zIndex: 9999,
                  left: '72px',
                  top: `${80 + (index * 48) + 24}px`,
                  transform: 'translateY(-50%)'
                }}
              >
                {item.name}
                <span 
                  className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900"
                  style={{ marginRight: '0px' }}
                ></span>
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Menu Items - LOGOUT ONLY */}
      <div className="border-t border-gray-200 shrink-0">
        <button
          onClick={() => {
            handleLogout();
            closeMobileMenu();
          }}
          className="w-full flex items-center md:justify-center h-12 px-4 md:px-0 relative group text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          
          {/* Text label visible on mobile */}
          <span className="md:hidden ml-4 font-medium text-sm">
            Logout
          </span>
          
          {/* Tooltip with Arrow - Desktop only */}
          <span 
            className="hidden md:block fixed px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg"
            style={{ 
              zIndex: 9999,
              left: '72px',
              bottom: '24px',
              transform: 'translateY(50%)'
            }}
          >
            Logout
            <span 
              className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900"
              style={{ marginRight: '0px' }}
            ></span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default Navbar;
