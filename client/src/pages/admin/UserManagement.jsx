import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, UserCheck, UserX, Users, Clock } from 'lucide-react';
import api from '../../utils/axios';
import Alert from '../../components/alert/Alert';

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [pagination, setPagination] = useState({
    all: { offset: 0, hasMore: true, total: 0 },
    pending: { offset: 0, hasMore: true, total: 0 }
  });

  const observerTarget = useRef(null);
  
  const [alert, setAlert] = useState({
    isOpen: false,
    severity: 'success',
    message: ''
  });

  const LIMIT = 20;

  const showAlert = (message, severity = 'success') => {
    setAlert({
      isOpen: true,
      severity,
      message
    });
  };

  const fetchUsers = async (isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isLoadMore ? (activeTab === 'all' ? users.length : pendingUsers.length) : 0;

      const [allUsersRes, pendingUsersRes] = await Promise.all([
        api.get(`/users?limit=${LIMIT}&offset=${activeTab === 'all' && isLoadMore ? currentOffset : 0}`),
        api.get(`/users/pending?limit=${LIMIT}&offset=${activeTab === 'pending' && isLoadMore ? currentOffset : 0}`)
      ]);

      if (allUsersRes.data.success) {
        if (isLoadMore && activeTab === 'all') {
          setUsers(prev => [...prev, ...allUsersRes.data.users]);
        } else if (!isLoadMore) {
          setUsers(allUsersRes.data.users);
        }
        
        setPagination(prev => ({
          ...prev,
          all: {
            offset: allUsersRes.data.pagination.offset,
            hasMore: allUsersRes.data.pagination.hasMore,
            total: allUsersRes.data.pagination.total
          }
        }));
      }

      if (pendingUsersRes.data.success) {
        if (isLoadMore && activeTab === 'pending') {
          setPendingUsers(prev => [...prev, ...pendingUsersRes.data.users]);
        } else if (!isLoadMore) {
          setPendingUsers(pendingUsersRes.data.users);
        }

        setPagination(prev => ({
          ...prev,
          pending: {
            offset: pendingUsersRes.data.pagination.offset,
            hasMore: pendingUsersRes.data.pagination.hasMore,
            total: pendingUsersRes.data.pagination.total
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showAlert('Failed to fetch users', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Infinite scroll observer
  const handleObserver = useCallback((entries) => {
    const [target] = entries;
    if (target.isIntersecting && !loadingMore) {
      const hasMore = activeTab === 'all' ? pagination.all.hasMore : pagination.pending.hasMore;
      if (hasMore) {
        fetchUsers(true);
      }
    }
  }, [loadingMore, pagination, activeTab]);

  useEffect(() => {
    const element = observerTarget.current;
    const option = { threshold: 0 };
    const observer = new IntersectionObserver(handleObserver, option);
    
    if (element) observer.observe(element);
    
    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);

  const handleApprove = async (userId) => {
    try {
      const response = await api.put(`/users/${userId}/approve`);
      if (response.data.success) {
        showAlert('User approved successfully', 'success');
        // Reset and refetch
        setPagination({
          all: { offset: 0, hasMore: true, total: 0 },
          pending: { offset: 0, hasMore: true, total: 0 }
        });
        fetchUsers();
      }
    } catch (error) {
      console.error('Error approving user:', error);
      showAlert(error.response?.data?.error || 'Failed to approve user', 'error');
    }
  };

  const handleReject = async (userId) => {
    if (!window.confirm('Are you sure you want to reject this user? Their account will be permanently deleted.')) {
      return;
    }

    try {
      const response = await api.delete(`/users/${userId}/reject`);
      if (response.data.success) {
        showAlert('User rejected successfully', 'success');
        setPagination({
          all: { offset: 0, hasMore: true, total: 0 },
          pending: { offset: 0, hasMore: true, total: 0 }
        });
        fetchUsers();
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
      showAlert(error.response?.data?.error || 'Failed to reject user', 'error');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await api.put(`/users/${userId}/role`, { role: newRole });
      if (response.data.success) {
        showAlert('User role updated successfully', 'success');
        
        // Update locally without refetch
        if (activeTab === 'all') {
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } else {
          setPendingUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        }
      }
    } catch (error) {
      console.error('Error updating role:', error);
      showAlert(error.response?.data?.error || 'Failed to update role', 'error');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/users/${userId}`);
      if (response.data.success) {
        showAlert('User deleted successfully', 'success');
        setPagination({
          all: { offset: 0, hasMore: true, total: 0 },
          pending: { offset: 0, hasMore: true, total: 0 }
        });
        fetchUsers();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showAlert(error.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700';
      case 'faculty':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const displayUsers = activeTab === 'all' ? users : pendingUsers;
  const currentPagination = activeTab === 'all' ? pagination.all : pagination.pending;

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <Alert
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        severity={alert.severity}
        message={alert.message}
        position="top"
      />

      <div className="mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/daily-cards')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Dashboard</span>
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b-2 border-gray-200">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                User Management
              </h1>
              <p className="text-gray-600">
                {pagination.all.total} total user{pagination.all.total !== 1 ? 's' : ''} · {pagination.pending.total} pending approval
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b-2 border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="w-4 h-4" />
              All Users ({pagination.all.total})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'pending'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="w-4 h-4" />
              Pending Approval ({pagination.pending.total})
            </button>
          </div>
        </div>

        {displayUsers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              {activeTab === 'all' ? 'No users found' : 'No pending approvals'}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Email</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Role</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Joined</th>
                      <th className="px-6 py-4 text-right text-sm font-bold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {displayUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                              {user.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <span className="font-semibold text-gray-900">{user.name || 'Unnamed'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-700">{user.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={user.role || 'faculty'}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className={`px-3 py-1 text-xs font-bold rounded capitalize cursor-pointer border-2 ${getRoleBadgeColor(user.role)}`}
                          >
                            <option value="admin">Admin</option>
                            <option value="faculty">Faculty</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          {user.has_approved ? (
                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
                              Approved
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600">{formatDate(user.created_at)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {!user.has_approved ? (
                              <>
                                <button
                                  onClick={() => handleApprove(user.id)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Approve user"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleReject(user.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Reject user"
                                >
                                  <UserX className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete user"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="py-4 text-center">
              {loadingMore && (
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
              )}
              
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
