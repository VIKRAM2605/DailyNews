import React from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import Header from "../components/header/Header";

// Public Pages
import Login from "../pages/login";
import Register from "../pages/Register";
import AuthCallback from "../pages/AuthCallback";

// Protected Route Component
import PrivateRoute from "../components/protectedroutes/ProtectedRoutes";

// Faculty Dashboard
const FacultyDashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Faculty Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {user?.username || 'Faculty Member'}!</p>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 font-medium">✓ Faculty Portal Access</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="w-full">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back, {user?.username || 'Administrator'}!</p>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <p className="text-purple-800 font-medium">🛡️ Admin Portal Access</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Placeholder components
const PlaceholderPage = ({ title }) => (
  <div className="min-h-screen bg-gray-50 p-6">
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600 mt-2">This page is under construction.</p>
      </div>
    </div>
  </div>
);

function AppLayout() {
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isAuthenticated = !!user;

  // Define routes where sidebar/header should be hidden
  const hideNavigationRoutes = ["/login", "/register", "/auth/callback"];
  const shouldShowNavigation = !hideNavigationRoutes.includes(location.pathname) && isAuthenticated;

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      {shouldShowNavigation && <Navbar />}
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col ${shouldShowNavigation ? 'ml-16' : ''}`}>
        {/* Header */}
        {shouldShowNavigation && <Header />}
        
        {/* Main Content with proper spacing */}
        <main className={`flex-1 overflow-x-hidden overflow-y-auto ${shouldShowNavigation ? 'mt-16' : ''}`}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Protected Routes */}
            <Route element={<PrivateRoute />}>
              {/* Root redirect based on role */}
              <Route path="/" element={
                user?.role === 'admin' ? <Navigate to="/admin/dashboard" /> : <Navigate to="/faculty/dashboard" />
              } />

              {/* Faculty Routes */}
              <Route path="/faculty/dashboard" element={<FacultyDashboard />} />
              <Route path="/faculty/articles" element={<PlaceholderPage title="My Articles" />} />
              <Route path="/faculty/submit-news" element={<PlaceholderPage title="Submit News" />} />
              <Route path="/faculty/calendar" element={<PlaceholderPage title="Calendar" />} />
              <Route path="/faculty/notifications" element={<PlaceholderPage title="Notifications" />} />
              <Route path="/faculty/settings" element={<PlaceholderPage title="Settings" />} />

              {/* Admin Routes */}
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/news" element={<PlaceholderPage title="All News" />} />
              <Route path="/admin/articles" element={<PlaceholderPage title="All Articles" />} />
              <Route path="/admin/users" element={<PlaceholderPage title="User Management" />} />
              <Route path="/admin/approvals" element={<PlaceholderPage title="Pending Approvals" />} />
              <Route path="/admin/analytics" element={<PlaceholderPage title="Analytics" />} />
              <Route path="/admin/notifications" element={<PlaceholderPage title="Notifications" />} />
              <Route path="/admin/settings" element={<PlaceholderPage title="Admin Settings" />} />

              {/* Legacy routes redirect based on role */}
              <Route path="/dashboard" element={
                user?.role === 'admin' ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/faculty/dashboard" replace />
              } />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
