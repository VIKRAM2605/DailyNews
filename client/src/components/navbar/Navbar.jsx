import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Newspaper, 
  Users, 
  Settings, 
  FileText,
  BarChart3,
  Calendar,
  Bell,
  LogOut,
  UserCheck,
} from 'lucide-react';

const Navbar = () => {
  // Get user from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = user?.role || 'faculty';

  // Faculty menu items
  const facultyMenuItems = [
    { 
      name: 'Dashboard', 
      icon: LayoutDashboard, 
      path: '/faculty/dashboard' 
    },
    { 
      name: 'My Articles', 
      icon: FileText, 
      path: '/faculty/articles' 
    },
    { 
      name: 'Submit News', 
      icon: Newspaper, 
      path: '/faculty/submit-news' 
    },
    { 
      name: 'Calendar', 
      icon: Calendar, 
      path: '/faculty/calendar' 
    },
    { 
      name: 'Notifications', 
      icon: Bell, 
      path: '/faculty/notifications' 
    },
  ];

  // Admin menu items
  const adminMenuItems = [
    { 
      name: 'Dashboard', 
      icon: LayoutDashboard, 
      path: '/admin/dashboard' 
    },
    { 
      name: 'All News', 
      icon: Newspaper, 
      path: '/admin/news' 
    },
    { 
      name: 'Articles', 
      icon: FileText, 
      path: '/admin/articles' 
    },
    { 
      name: 'Users', 
      icon: Users, 
      path: '/admin/users' 
    },
    { 
      name: 'Approvals', 
      icon: UserCheck, 
      path: '/admin/approvals' 
    },
    { 
      name: 'Analytics', 
      icon: BarChart3, 
      path: '/admin/analytics' 
    },
    { 
      name: 'Notifications', 
      icon: Bell, 
      path: '/admin/notifications' 
    },
  ];

  // Select menu based on role
  const menuItems = userRole === 'admin' ? adminMenuItems : facultyMenuItems;

  const bottomMenuItems = [
    { 
      name: 'Settings', 
      icon: Settings, 
      path: userRole === 'admin' ? '/admin/settings' : '/faculty/settings'
    },
    { 
      name: 'Logout', 
      icon: LogOut, 
      path: '/logout',
      action: 'logout'
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="fixed left-0 top-0 h-screen w-16 bg-white border-r border-gray-200 shadow-sm flex flex-col overflow-hidden" style={{ zIndex: 40 }}>
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-gray-200 group shrink-0">
        <div className="relative">
          {/* Newspaper icon logo */}
          <Newspaper className="w-7 h-7 text-slate-900" strokeWidth={2} />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></div>
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
              className={({ isActive }) =>
                `flex items-center justify-center h-12 relative group shrink-0 ${
                  isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-slate-900 hover:bg-gray-50'
                } transition-all duration-200`
              }
            >
              <Icon className="w-5 h-5" />
              
              {/* Tooltip with Arrow */}
              <span 
                className="fixed px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg"
                style={{ 
                  zIndex: 9999,
                  left: '72px',
                  top: `${80 + (index * 48) + 24}px`,
                  transform: 'translateY(-50%)'
                }}
              >
                {item.name}
                {/* Arrow */}
                <span 
                  className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900"
                  style={{ marginRight: '0px' }}
                ></span>
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Menu Items */}
      <div className="border-t border-gray-200 shrink-0">
        {bottomMenuItems.map((item, index) => {
          const Icon = item.icon;
          
          if (item.action === 'logout') {
            return (
              <button
                key={item.name}
                onClick={handleLogout}
                className="w-full flex items-center justify-center h-12 relative group text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
              >
                <Icon className="w-5 h-5" />
                
                {/* Tooltip with Arrow */}
                <span 
                  className="fixed px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg"
                  style={{ 
                    zIndex: 9999,
                    left: '72px',
                    bottom: `${(bottomMenuItems.length - index - 1) * 48 + 24}px`,
                    transform: 'translateY(50%)'
                  }}
                >
                  {item.name}
                  {/* Arrow */}
                  <span 
                    className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900"
                    style={{ marginRight: '0px' }}
                  ></span>
                </span>
              </button>
            );
          }

          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-center h-12 relative group ${
                  isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-slate-900 hover:bg-gray-50'
                } transition-all duration-200`
              }
            >
              <Icon className="w-5 h-5" />
              
              {/* Tooltip with Arrow */}
              <span 
                className="fixed px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg"
                style={{ 
                  zIndex: 9999,
                  left: '72px',
                  bottom: `${(bottomMenuItems.length - index - 1) * 48 + 24}px`,
                  transform: 'translateY(50%)'
                }}
              >
                {item.name}
                {/* Arrow */}
                <span 
                  className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900"
                  style={{ marginRight: '0px' }}
                ></span>
              </span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};

export default Navbar;
