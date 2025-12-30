import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Calendar, Clock, User, FileText, RefreshCw, Eye, AlertCircle, X, Edit3, Lock } from 'lucide-react';
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
  const [checkingPermissions, setCheckingPermissions] = useState(false); // ✅ New
  const [cardPermissions, setCardPermissions] = useState({}); // ✅ Cache permissions

  const [alert, setAlert] = useState({
    isOpen: false,
    severity: 'success',
    message: ''
  });

  const showAlert = (message, severity = 'success') => {
    setAlert({ isOpen: true, severity, message });
  };

  // ✅ Check permission for a specific card
  const checkCardPermission = async (cardId) => {
    try {
      const response = await api.get(`/faculty/daily-card/card/${cardId}/check-permission`);
      return response.data.success ? response.data.has_access : false;
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  };

  const fetchGroupDetails = async () => {
    try {
      const response = await api.get(`/faculty/daily-card/group/${groupId}`);
      console.log('📊 Group details:', response.data);
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
      console.log('📋 Cards:', response.data);
      
      if (response.data.success) {
        const cardsList = response.data.cards;
        setCards(cardsList);

        // ✅ Check permissions for today's cards only
        if (groupDetails?.is_today) {
          checkCardsPermissions(cardsList);
        }
      }
    } catch (error) {
      console.error('Error fetching cards:', error);
      showAlert('Failed to fetch cards', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Check permissions for all cards in group
  const checkCardsPermissions = async (cardsList) => {
    setCheckingPermissions(true);
    try {
      const permissions = {};
      for (const card of cardsList) {
        const hasAccess = await checkCardPermission(card.id);
        permissions[card.id] = hasAccess;
      }
      setCardPermissions(permissions);
    } catch (error) {
      console.error('Bulk permission check error:', error);
    } finally {
      setCheckingPermissions(false);
    }
  };

  const handleCreateCard = async () => {
    if (!formData.card_title.trim()) {
      showAlert('Please enter a card title', 'error');
      return;
    }

    console.log('📝 Creating card with:', formData);
    setCreating(true);
    try {
      const response = await api.post(`/faculty/daily-card/group/${groupId}/cards`, formData);
      console.log('✅ Card created:', response.data);
      
      if (response.data.success) {
        showAlert('Card created successfully', 'success');
        setShowCreateModal(false);
        setFormData({ card_title: '' });
        await fetchCards();
        await fetchGroupDetails();
      }
    } catch (error) {
      console.error('❌ Error creating card:', error);
      console.error('Error response:', error.response?.data);
      const errorMsg = error.response?.data?.error || 'Failed to create card';
      showAlert(errorMsg, 'error');
    } finally {
      setCreating(false);
    }
  };

  // ✅ Navigate based on permission
  const handleViewCard = async (cardId) => {
    if (groupDetails?.is_today && cardPermissions[cardId]) {
      // ✅ Has edit access → Edit mode
      navigate(`/faculty/daily-cards/${groupId}/card/${cardId}`);
    } else {
      // ✅ No access OR past date → View only
      navigate(`/faculty/daily-cards/${groupId}/card/${cardId}?viewOnly=true`);
    }
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

  // ✅ Get card action text and icon
  const getCardAction = (card) => {
    if (!groupDetails?.is_today) {
      return { text: 'Click to view content', icon: Eye, color: 'text-gray-400' };
    }
    
    const hasPermission = cardPermissions[card.id];
    if (hasPermission === true) {
      return { text: 'Click to edit content', icon: Edit3, color: 'text-green-600' };
    }
    
    return { text: 'Click to view content', icon: Eye, color: 'text-gray-400' };
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

          {/* Permission Notices */}
          {groupDetails?.is_past && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-900">
                This is a past date. You can only view cards and their content. Editing is disabled.
              </p>
            </div>
          )}

          {groupDetails?.is_today && checkingPermissions && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <RefreshCw className="w-5 h-5 text-blue-600 shrink-0 mt-0.5 animate-spin" />
              <p className="text-sm text-blue-900">Checking edit permissions...</p>
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
              {cards.map((card, index) => {
                const action = getCardAction(card);
                
                return (
                  <div
                    key={card.id}
                    onClick={() => handleViewCard(card.id)}
                    className={`p-5 border-2 rounded-lg hover:shadow-md transition-all cursor-pointer ${
                      action.icon === Edit3
                        ? 'border-green-200 hover:border-green-400 bg-green-50/50'
                        : 'border-gray-200 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                            #{index + 1}
                          </span>
                          <h3 className="text-lg font-bold text-gray-900">{card.card_title}</h3>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-2">
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
                        {/* ✅ Dynamic action text + icon */}
                        <div className={`flex items-center gap-1 text-xs font-medium ${action.color}`}>
                          {action.icon === Edit3 ? (
                            <>
                              <Edit3 className="w-3 h-3" />
                              <span>{action.text}</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>{action.text}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CREATE CARD MODAL - UNCHANGED */}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && formData.card_title.trim()) {
                      handleCreateCard();
                    }
                  }}
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
