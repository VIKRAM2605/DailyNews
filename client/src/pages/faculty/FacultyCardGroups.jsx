import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, FileText, RefreshCw, Clock, User, Eye, AlertCircle } from 'lucide-react';
import api from '../../utils/axios';
import Alert from '../../components/alert/Alert';

const FacultyCardGroups = () => {
  const navigate = useNavigate();
  const [cardGroups, setCardGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [alert, setAlert] = useState({
    isOpen: false,
    severity: 'success',
    message: ''
  });

  const [pagination, setPagination] = useState({
    offset: 0,
    hasMore: true,
    total: 0
  });

  const observerTarget = useRef(null);
  const LIMIT = 12;

  const showAlert = (message, severity = 'success') => {
    setAlert({ isOpen: true, severity, message });
  };

  const fetchCardGroups = async (isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isLoadMore ? cardGroups.length : 0;
      const response = await api.get(`/faculty/daily-card/groups?limit=${LIMIT}&offset=${currentOffset}`);
      
      if (response.data.success) {
        if (isLoadMore) {
          setCardGroups(prev => [...prev, ...response.data.cardGroups]);
        } else {
          setCardGroups(response.data.cardGroups);
        }

        setPagination({
          offset: response.data.pagination.offset,
          hasMore: response.data.pagination.hasMore,
          total: response.data.pagination.total
        });
      }
    } catch (error) {
      console.error('Error fetching card groups:', error);
      showAlert('Failed to fetch card groups', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleObserver = useCallback((entries) => {
    const [target] = entries;
    if (target.isIntersecting && !loadingMore && !loading && pagination.hasMore) {
      fetchCardGroups(true);
    }
  }, [loadingMore, loading, pagination.hasMore, cardGroups.length]);

  useEffect(() => {
    const element = observerTarget.current;
    const option = { threshold: 0 };
    const observer = new IntersectionObserver(handleObserver, option);
    
    if (element) observer.observe(element);
    
    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);

  useEffect(() => {
    fetchCardGroups();
  }, []);

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

  const handleViewGroup = (groupId) => {
    navigate(`/faculty/daily-cards/${groupId}`);
  };

  if (loading && cardGroups.length === 0) {
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

      <div className="w-full">
        {/* Header */}
        <div className="mb-8 pb-6 border-b-2 border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Card Groups</h1>
          <p className="text-gray-600">
            {pagination.total} card group{pagination.total !== 1 ? 's' : ''} available
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900">
              You can <strong>create cards only for today</strong>. For past dates, you can only view existing cards and their content.
            </p>
          </div>
        </div>

        {/* Card Groups Grid */}
        {cardGroups.length === 0 && !loading ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No card groups available</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cardGroups.map((group) => (
                <div
                  key={group.id}
                  className={`relative border-2 rounded-lg p-5 transition-all cursor-pointer hover:shadow-md ${
                    group.is_today
                      ? 'border-green-300 bg-green-50 hover:border-green-400'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => handleViewGroup(group.id)}
                >
                  {/* Today Badge */}
                  {group.is_today && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-1 bg-green-600 text-white text-xs font-bold rounded">
                        TODAY
                      </span>
                    </div>
                  )}

                  {/* Date */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                      <Calendar className="w-3 h-3" />
                      <span>Date</span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {formatDate(group.group_date)}
                    </h3>
                  </div>

                  {/* Card Count */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="w-4 h-4" />
                      <span>{group.card_count} card{group.card_count !== 1 ? 's' : ''}</span>
                    </div>
                    {group.creator_name && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <User className="w-3 h-3" />
                        <span>{group.creator_name}</span>
                      </div>
                    )}
                  </div>

                  {/* View Button */}
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    <Eye className="w-4 h-4" />
                    {group.is_today ? 'Manage Cards' : 'View Cards'}
                  </button>
                </div>
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="py-6 text-center">
              {loadingMore && (
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
              )}
              {!pagination.hasMore && cardGroups.length > 0 && (
                <p className="text-gray-500 text-sm">No more card groups to load</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FacultyCardGroups;
