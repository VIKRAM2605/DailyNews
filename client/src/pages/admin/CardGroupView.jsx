import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Calendar, Clock, User, FileText, RefreshCw, Trash2, Edit, Eye, X, AlertTriangle } from 'lucide-react';
import api from '../../utils/axios';
import Alert from '../../components/alert/Alert';

const CardGroupView = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [groupDetails, setGroupDetails] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [deletingCard, setDeletingCard] = useState(null);
  const [formData, setFormData] = useState({ card_title: '' });
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const LIMIT = 20;

  const showAlert = (message, severity = 'success') => {
    setAlert({
      isOpen: true,
      severity,
      message
    });
  };

  const fetchGroupDetails = async () => {
    try {
      const response = await api.get(`/daily-card/group/${groupId}`);
      if (response.data.success) {
        setGroupDetails(response.data.group);
      }
    } catch (error) {
      console.error('Error fetching group details:', error);
      showAlert('Failed to fetch group details', 'error');
    }
  };

  const fetchCards = async (isLoadMore = false) => {
    if (!isLoadMore) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isLoadMore ? cards.length : 0;
      const response = await api.get(`/daily-card/group/${groupId}/cards?limit=${LIMIT}&offset=${currentOffset}`);
      
      if (response.data.success) {
        if (isLoadMore) {
          setCards(prev => [...prev, ...response.data.cards]);
        } else {
          setCards(response.data.cards);
        }

        setPagination({
          offset: response.data.pagination.offset,
          hasMore: response.data.pagination.hasMore,
          total: response.data.pagination.total
        });
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
      showAlert('Failed to fetch cards', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleObserver = useCallback((entries) => {
    const [target] = entries;
    if (target.isIntersecting && !loadingMore && !loading && pagination.hasMore) {
      fetchCards(true);
    }
  }, [loadingMore, loading, pagination.hasMore, cards.length]);

  useEffect(() => {
    const element = observerTarget.current;
    const option = { threshold: 0 };
    const observer = new IntersectionObserver(handleObserver, option);
    
    if (element) observer.observe(element);
    
    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);

  const handleCreateCard = async () => {
    if (!formData.card_title.trim()) {
      showAlert('Please enter a card title', 'error');
      return;
    }

    setCreating(true);
    try {
      const response = await api.post(`/daily-card/group/${groupId}/cards`, formData);
      if (response.data.success) {
        showAlert('Card created successfully', 'success');
        setShowCreateModal(false);
        setFormData({ card_title: '' });
        setCards([]);
        setPagination({ offset: 0, hasMore: true, total: 0 });
        fetchCards();
        fetchGroupDetails();
      }
    } catch (error) {
      console.error('Error creating card:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to create card';
      showAlert(errorMsg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleEditCard = async () => {
    if (!formData.card_title.trim()) {
      showAlert('Please enter a card title', 'error');
      return;
    }

    setUpdating(true);
    try {
      const response = await api.put(`/daily-card/cards/${editingCard.id}`, formData);
      if (response.data.success) {
        showAlert('Card updated successfully', 'success');
        setCards(prev => prev.map(card => 
          card.id === editingCard.id ? response.data.card : card
        ));
        setShowEditModal(false);
        setEditingCard(null);
        setFormData({ card_title: '' });
      }
    } catch (error) {
      console.error('Error updating card:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to update card';
      showAlert(errorMsg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCard = async () => {
    setDeleting(true);
    try {
      const response = await api.delete(`/daily-card/cards/${deletingCard.id}`);
      if (response.data.success) {
        showAlert('Card deleted successfully', 'success');
        setShowDeleteModal(false);
        setDeletingCard(null);
        setCards([]);
        setPagination({ offset: 0, hasMore: true, total: 0 });
        fetchCards();
        fetchGroupDetails();
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to delete card';
      showAlert(errorMsg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const openEditModal = (card) => {
    setEditingCard(card);
    setFormData({ card_title: card.card_title });
    setShowEditModal(true);
  };

  const openDeleteModal = (card) => {
    setDeletingCard(card);
    setShowDeleteModal(true);
  };

  const handleViewCard = (cardId) => {
    navigate(`/admin/daily-cards/${groupId}/card/${cardId}`);
  };

  useEffect(() => {
    const initFetch = async () => {
      setLoading(true);
      await Promise.all([
        fetchGroupDetails(),
        fetchCards()
      ]);
    };
    
    initFetch();
  }, [groupId]);

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

  if (loading && cards.length === 0) {
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
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin/daily-cards')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Card Groups</span>
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b-2 border-gray-200">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {formatDate(groupDetails?.group_date)}
              </h1>
              <p className="text-gray-600">
                {pagination.total} card{pagination.total !== 1 ? 's' : ''} in this group
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Card
            </button>
          </div>
        </div>

        {/* Group Info */}
        {groupDetails && (
          <div className="bg-blue-50 rounded-lg border-2 border-blue-200 p-5 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                  <Calendar className="w-3 h-3" />
                  <span>Created At</span>
                </div>
                <p className="font-semibold text-gray-900">{formatTime(groupDetails.created_at)}</p>
              </div>

              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                  <FileText className="w-3 h-3" />
                  <span>Total Cards</span>
                </div>
                <p className="font-semibold text-gray-900">{pagination.total}</p>
              </div>

              {groupDetails.creator_name && (
                <div className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                    <User className="w-3 h-3" />
                    <span>Created By</span>
                  </div>
                  <p className="font-semibold text-gray-900">{groupDetails.creator_name}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cards List */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Cards</h2>

          {cards.length === 0 && !loading ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No cards in this group yet</p>
              <p className="text-gray-400 text-sm mt-1">Click "Add Card" to create your first card</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {cards.map((card, index) => (
                  <div
                    key={card.id}
                    className="p-5 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                            #{index + 1}
                          </span>
                          <h3 className="text-lg font-bold text-gray-900">{card.card_title}</h3>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatTime(card.created_at)}
                          </span>
                          {card.creator_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {card.creator_name}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleViewCard(card.id)}
                          className="flex items-center gap-2 text-gray-400 hover:text-blue-600 text-sm transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Click to view and generate</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(card)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit card title"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(card)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete card"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div ref={observerTarget} className="py-4 text-center">
                {loadingMore && (
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                )}
              </div>
            </>
          )}
        </div>

        {/* ✅ CREATE CARD MODAL */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => !creating && setShowCreateModal(false)}
            ></div>

            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Plus className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Add New Card</h3>
                </div>
                <button
                  onClick={() => !creating && setShowCreateModal(false)}
                  disabled={creating}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Card Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.card_title}
                  onChange={(e) => setFormData({ card_title: e.target.value })}
                  placeholder="Enter card title"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateCard}
                  disabled={creating || !formData.card_title.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Create
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ card_title: '' });
                  }}
                  disabled={creating}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-all font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ EDIT CARD MODAL */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => !updating && setShowEditModal(false)}
            ></div>

            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <Edit className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">Edit Card Title</h3>
                </div>
                <button
                  onClick={() => {
                    if (!updating) {
                      setShowEditModal(false);
                      setEditingCard(null);
                      setFormData({ card_title: '' });
                    }
                  }}
                  disabled={updating}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Card Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.card_title}
                  onChange={(e) => setFormData({ card_title: e.target.value })}
                  placeholder="Enter card title"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleEditCard}
                  disabled={updating || !formData.card_title.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="w-3.5 h-3.5" />
                      Update
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCard(null);
                    setFormData({ card_title: '' });
                  }}
                  disabled={updating}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-all font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ DELETE CONFIRMATION MODAL */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => !deleting && setShowDeleteModal(false)}
            ></div>

            <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
              <div className="flex justify-center mb-4">
                <div className="p-2.5 bg-red-100 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>

              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Card?</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Delete <span className="font-semibold text-gray-900">"{deletingCard?.card_title}"</span>?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <p className="text-xs text-red-800">
                    This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingCard(null);
                  }}
                  disabled={deleting}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-all font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCard}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardGroupView;
