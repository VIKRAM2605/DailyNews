import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Calendar, Plus, CheckCircle, AlertCircle, RefreshCw, Layers, X, Clock, User, ChevronRight } from 'lucide-react';
import api from '../../utils/axios';
import { useNavigate } from 'react-router-dom';

const DailyCards = () => {
  const navigate = useNavigate();
  const [todayCardGroup, setTodayCardGroup] = useState(null);
  const [cardGroupExists, setCardGroupExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [allCardGroups, setAllCardGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const [pagination, setPagination] = useState({
    offset: 0,
    hasMore: true,
    total: 0
  });

  const observerTarget = useRef(null);
  const LIMIT = 12;

  // Fetch today's card group
  const fetchTodayCardGroup = async () => {
    try {
      const response = await api.get('/daily-card/today');
      if (response.data.success) {
        setCardGroupExists(response.data.exists);
        setTodayCardGroup(response.data.cardGroup || null);
      }
    } catch (error) {
      console.error('Error fetching today card group:', error);
    }
  };

  // ✅ Fetch all card groups with pagination
  const fetchAllCardGroups = async (isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isLoadMore ? allCardGroups.length : 0;
      const response = await api.get(`/daily-card/all?limit=${LIMIT}&offset=${currentOffset}`);
      
      if (response.data.success) {
        if (isLoadMore) {
          setAllCardGroups(prev => [...prev, ...response.data.cardGroups]);
        } else {
          setAllCardGroups(response.data.cardGroups);
        }

        setPagination({
          offset: response.data.pagination.offset,
          hasMore: response.data.pagination.hasMore,
          total: response.data.pagination.total
        });
      }
    } catch (error) {
      console.error('Error fetching all card groups:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // ✅ Infinite scroll observer - prevent duplicates
  const handleObserver = useCallback((entries) => {
    const [target] = entries;
    if (target.isIntersecting && !loadingMore && !loading && pagination.hasMore) {
      fetchAllCardGroups(true);
    }
  }, [loadingMore, loading, pagination.hasMore, allCardGroups.length]); // ✅ Added dependencies

  useEffect(() => {
    const element = observerTarget.current;
    const option = { threshold: 0 };
    const observer = new IntersectionObserver(handleObserver, option);
    
    if (element) observer.observe(element);
    
    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);

  // Create card group manually
  const handleCreateCardGroup = async () => {
    setCreating(true);
    try {
      const response = await api.post('/daily-card/create');
      if (response.data.success) {
        setTodayCardGroup(response.data.cardGroup);
        setCardGroupExists(true);
        setShowCreateModal(false);
        // Reset and refetch
        setAllCardGroups([]);
        setPagination({ offset: 0, hasMore: true, total: 0 });
        fetchAllCardGroups();
      }
    } catch (error) {
      console.error('Error creating card group:', error);
      alert(error.response?.data?.error || 'Failed to create card group');
    } finally {
      setCreating(false);
    }
  };

  const handleGroupClick = (group) => {
    navigate(`/admin/daily-cards/${group.id}`);
  };

  // ✅ Fixed: Only fetch once on mount
  useEffect(() => {
    const initFetch = async () => {
      setLoading(true);
      await Promise.all([
        fetchTodayCardGroup(),
        fetchAllCardGroups()
      ]);
    };
    
    initFetch();
  }, []); // ✅ Empty dependency array - runs once

  const formatDate = (dateString) => {
    if (!dateString) return 'Invalid date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return 'Invalid';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid';
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // ✅ Manual refresh handler
  const handleRefresh = () => {
    setAllCardGroups([]);
    setPagination({ offset: 0, hasMore: true, total: 0 });
    fetchAllCardGroups();
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8 pb-6 border-b-2 border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Card Groups</h1>
          <p className="text-gray-600">Auto-generated daily at midnight IST • One group per day • Total: {pagination.total} groups</p>
        </div>

        {/* Today's Card Group Status */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Today's Card Group Status</h2>
              {loading ? (
                <div className="flex items-center gap-2 text-gray-600">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Checking status...</span>
                </div>
              ) : cardGroupExists ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Card group exists for today</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold">No card group found for today</span>
                </div>
              )}
            </div>

            {!cardGroupExists && !loading && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Create Manually
              </button>
            )}
          </div>

          {/* Today's Card Group Details */}
          {cardGroupExists && todayCardGroup && (
            <div className="p-5 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <p className="text-lg font-bold text-gray-900">
                      {formatDate(todayCardGroup.group_date)}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                        <Clock className="w-3 h-3" />
                        <span>Created At</span>
                      </div>
                      <p className="font-semibold text-gray-900">{formatTime(todayCardGroup.created_at)}</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                        <Layers className="w-3 h-3" />
                        <span>Today's Card Group Cards Count</span>
                      </div>
                      <p className="font-semibold text-gray-900">{todayCardGroup.card_count || 0} cards</p>
                    </div>

                    {todayCardGroup.creator_name && (
                      <div className="bg-white rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                          <User className="w-3 h-3" />
                          <span>Created By</span>
                        </div>
                        <p className="font-semibold text-gray-900">{todayCardGroup.creator_name}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <span className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                  todayCardGroup.created_by === null 
                    ? 'bg-green-100 text-green-700 border border-green-300' 
                    : 'bg-purple-100 text-purple-700 border border-purple-300'
                }`}>
                  {todayCardGroup.created_by === null ? '🤖 Auto-Generated' : '✍️ Manual'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recent Card Groups */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Card Groups ({pagination.total})</h2>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {allCardGroups.length === 0 && !loading ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No card groups created yet</p>
              <p className="text-gray-400 text-sm mt-1">Card groups will appear here once created</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allCardGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleGroupClick(group)}
                    className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all duration-200 bg-white text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className={`px-2 py-1 text-xs font-bold rounded ${
                        group.created_by === null 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {group.created_by === null ? 'Auto' : 'Manual'}
                      </span>
                    </div>
                    
                    <p className="text-sm font-bold text-gray-900 mb-3">
                      {formatShortDate(group.group_date)}
                    </p>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Layers className="w-3 h-3" />
                        <span className="font-semibold">{group.card_count || 0}</span>
                        <span className="text-xs">cards</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>

              {/* ✅ Infinite scroll trigger */}
              <div ref={observerTarget} className="py-4 text-center">
                {loadingMore && (
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                )}
              </div>
            </>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            ></div>
            
            <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Create Today's Card Group</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                This will create a new card group for today's date.
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 mb-1">Important</p>
                    <p className="text-xs text-amber-800">
                      Only one card group per day is allowed. Creating this manually will prevent auto-generation for today.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateCardGroup}
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create Card Group'
                  )}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyCards;
