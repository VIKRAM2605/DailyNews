import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Calendar, Clock, User, FileText, RefreshCw, Eye, AlertCircle, X } from 'lucide-react';
import api from '../../utils/axios';
import Alert from '../../components/alert/Alert';

const FacultyCardGroupView = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [groupDetails, setGroupDetails] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ card_title: '' });
  const [creating, setCreating] = useState(false);

  const [alert, setAlert] = useState({
    isOpen: false,
    severity: 'success',
    message: ''
  });

  const showAlert = (message, severity = 'success') => {
    setAlert({ isOpen: true, severity, message });
  };

  const fetchGroupDetails = async () => {
    try {
      const response = await api.get(`/faculty/daily-card/group/${groupId}`);
      if (response.data.success) {
        setGroupDetails(response.data.group);
      }
    } catch (error) {
      console.error('Error fetching group details:', error);
      showAlert('Failed to fetch group details', 'error');
    }
  };

  const fetchCards = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/faculty/daily-card/group/${groupId}/cards`);
      
      if (response.data.success) {
        setCards(response.data.cards);
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
      showAlert('Failed to fetch cards', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCard = async () => {
    if (!formData.card_title.trim()) {
      showAlert('Please enter a card title', 'error');
      return;
    }

    setCreating(true);
    try {
      const response = await api.post(`/faculty/daily-card/group/${groupId}/cards`, formData);
      if (response.data.success) {
        showAlert('Card created successfully', 'success');
        setShowCreateModal(false);
        setFormData({ card_title: '' });
        fetchCards();
        fetchGroupDetails();
      }
    } catch (error) {
      console.error('Error creating card:', error);
      const errorMsg = error.response?.data?.error || 'Failed to create card';
      showAlert(errorMsg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleViewCard = (cardId) => {
    navigate(`/faculty/daily-cards/${groupId}/card/${cardId}`);
  };

  useEffect(() => {
    const initFetch = async () => {
      await Promise.all([fetchGroupDetails(), fetchCards()]);
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

  if (loading && !groupDetails) {
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
            onClick={() => navigate('/faculty/daily-cards')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Card Groups</span>
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b-2 border-gray-200">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  {formatDate(groupDetails?.group_date)}
                </h1>
                {groupDetails?.is_today && (
                  <span className="px-3 py-1 bg-green-600 text-white text-sm font-bold rounded">
                    TODAY
                  </span>
                )}
              </div>
              <p className="text-gray-600">
                {cards.length} card{cards.length !== 1 ? 's' : ''} in this group
              </p>
            </div>
            {groupDetails?.is_today && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Card
              </button>
            )}
          </div>

          {/* Permission Notice */}
          {groupDetails?.is_past && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-900">
                This is a past date. You can only view cards and their content. Editing is disabled.
              </p>
            </div>
          )}
        </div>

        {/* Cards List */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Cards</h2>

          {cards.length === 0 && !loading ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No cards in this group yet</p>
              {groupDetails?.is_today && (
                <p className="text-gray-400 text-sm mt-1">Click "Add Card" to create your first card</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  className="p-5 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-all"
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
                        <span>{groupDetails?.is_today ? 'Edit content' : 'View content'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CREATE CARD MODAL */}
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
      </div>
    </div>
  );
};

export default FacultyCardGroupView;
