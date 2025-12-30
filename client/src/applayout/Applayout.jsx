import React from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import Navbar from "../components/navbar/Navbar";
import Header from "../components/header/Header";

// Public Pages
import Login from "../pages/login";
import Register from "../pages/Register";
import AuthCallback from "../pages/AuthCallback";
import GoogleCallback from '../pages/GoogleCallback';

// Admin Pages
import DailyCards from "../pages/admin/DailyCards";
import CardGroupView from "../pages/admin/CardGroupView";
import CardDetailView from "../pages/admin/CardDetailView";
import FieldMetadataManager from "../pages/admin/FieldMetadataManager";
import UserManagement from '../pages/admin/UserManagement';

// Faculty Pages
import FacultyCardGroups from '../pages/faculty/FacultyCardGroups';
import FacultyCardGroupView from '../pages/faculty/FacultyCardGroupView';
import FacultyCardContent from '../pages/faculty/FacultyCardContent';

// Protected Route Component
import PrivateRoute from "../components/protectedroutes/ProtectedRoutes";

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
            <Route path="/auth/google/callback" element={<GoogleCallback />} />

            {/* Protected Routes */}
            <Route element={<PrivateRoute />}>
              {/* Root redirect based on role - Direct to daily cards */}
              <Route path="/" element={
                user?.role === 'admin' ? <Navigate to="/admin/daily-cards" /> : <Navigate to="/faculty/daily-cards" />
              } />

              {/* Faculty Routes - ACTIVE */}
              <Route path="/faculty/daily-cards" element={<FacultyCardGroups />} />
              <Route path="/faculty/daily-cards/:groupId" element={<FacultyCardGroupView />} />
              <Route path="/faculty/daily-cards/:groupId/card/:cardId" element={<FacultyCardContent />} />

              {/* Admin Routes - ACTIVE */}
              <Route path="/admin/daily-cards" element={<DailyCards />} />
              <Route path="/admin/daily-cards/:groupId" element={<CardGroupView />} />
              <Route path="/admin/daily-cards/:groupId/card/:cardId" element={<CardDetailView />} />
              <Route path="/admin/field-metadata" element={<FieldMetadataManager />} />
              <Route path="/admin/users" element={<UserManagement />} />

              {/* Legacy routes redirect based on role */}
              <Route path="/dashboard" element={
                user?.role === 'admin' ? <Navigate to="/admin/daily-cards" replace /> : <Navigate to="/faculty/daily-cards" replace />
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
