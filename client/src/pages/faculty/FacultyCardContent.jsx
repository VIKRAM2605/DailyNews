import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, RefreshCw, AlertCircle, FileText, Users, Trash2, Lock } from 'lucide-react';
import api from '../../utils/axios';
import Alert from '../../components/alert/Alert';
import socketService from '../../utils/socketService';

const FacultyCardContent = () => {
  const { groupId, cardId } = useParams();
  const navigate = useNavigate();
  const [cardDetails, setCardDetails] = useState(null);
  const [fieldMetadata, setFieldMetadata] = useState([]);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [checkingPermission, setCheckingPermission] = useState(true);

  const [onlineCount, setOnlineCount] = useState(1);
  const [activeEditors, setActiveEditors] = useState({});

  const [alert, setAlert] = useState({
    isOpen: false,
    severity: 'success',
    message: ''
  });

  const userId = localStorage.getItem('userId') || '1';
  const userName = localStorage.getItem('userName') || 'Faculty User';
  const userEmail = localStorage.getItem('userEmail') || '';

  const userColors = [
    'rgb(34, 197, 94)',
    'rgb(59, 130, 246)',
    'rgb(249, 115, 22)',
    'rgb(168, 85, 247)',
    'rgb(236, 72, 153)',
    'rgb(14, 165, 233)',
    'rgb(234, 179, 8)',
    'rgb(239, 68, 68)',
  ];

  const getUserColor = (userId) => {
    const hash = userId.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return userColors[hash % userColors.length];
  };

  const getDisplayName = (name, email) => {
    if (name && name.trim() !== '') return name;
    if (email && email.trim() !== '') return email;
    return 'Unknown User';
  };

  const showAlert = (message, severity = 'success') => {
    setAlert({ isOpen: true, severity, message });
  };

  // ✅ Check permission first
  useEffect(() => {
    const checkPermission = async () => {
      setCheckingPermission(true);
      try {
        const response = await api.get(`/faculty/daily-card/card/${cardId}/check-permission`);

        if (response.data.success) {
          setHasPermission(response.data.has_access);

          if (!response.data.has_access) {
            showAlert('You do not have permission to edit this card', 'error');
          }
        }
      } catch (error) {
        console.error('Permission check error:', error);
        setHasPermission(false);
        showAlert('Failed to verify permissions', 'error');
      } finally {
        setCheckingPermission(false);
      }
    };

    checkPermission();
  }, [cardId]);

  // Load draft from localStorage
  useEffect(() => {
    const draftKey = `faculty_card_draft_${cardId}`;
    const savedDraft = localStorage.getItem(draftKey);

    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setFormData(draft.formData || {});
        console.log('✅ Faculty: Loaded draft from localStorage');
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, [cardId]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (Object.keys(formData).length === 0) return;

    const draftKey = `faculty_card_draft_${cardId}`;
    const draft = {
      formData,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [formData, cardId]);

  // Socket.IO initialization
  useEffect(() => {
    console.log('🔌 Faculty: Initializing socket...');

    const socket = socketService.connect();
    socketService.joinCard(cardId, userId, userName, userEmail);

    socketService.onRoomUserCount(({ count }) => {
      setOnlineCount(count);
    });

    socketService.onFieldUpdated(({ fieldName, value, userId: editorId, userName: updaterName, userEmail: updaterEmail }) => {
      setFormData(prev => ({ ...prev, [fieldName]: value }));

      const editorColor = getUserColor(editorId);
      const displayName = getDisplayName(updaterName, updaterEmail);

      setActiveEditors(prev => ({
        ...prev,
        [fieldName]: {
          userName: updaterName,
          userEmail: updaterEmail,
          displayName,
          userId: editorId,
          color: editorColor
        }
      }));

      setTimeout(() => {
        setActiveEditors(prev => {
          const updated = { ...prev };
          delete updated[fieldName];
          return updated;
        });
      }, 3000);
    });

    socketService.onUserJoined(({ userName: newUser, count }) => {
      setOnlineCount(count);
    });

    socketService.onUserLeft(({ count }) => {
      setOnlineCount(count);
    });

    return () => {
      socketService.removeAllListeners();
      socketService.disconnect();
    };
  }, [cardId, userId, userName, userEmail]);

  const fetchCardDetails = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/faculty/daily-card/card/${cardId}`);

      if (response.data.success) {
        const cardData = response.data.card;
        setCardDetails(cardData); // ✅ Keep full card data with is_today

        const metadata = cardData.field_metadata || [];
        setFieldMetadata(metadata);

        let existingContent = cardData.card_content || {};

        if (typeof existingContent === 'string') {
          try {
            existingContent = JSON.parse(existingContent);
          } catch (e) {
            console.error('❌ Failed to parse card_content:', e);
            existingContent = {};
          }
        }

        const draftKey = `faculty_card_draft_${cardId}`;
        const savedDraft = localStorage.getItem(draftKey);

        if (!savedDraft) {
          const initialData = {};
          metadata.forEach(field => {
            initialData[field.field_name] = existingContent[field.field_name] || '';
          });
          setFormData(initialData);
        }
      }
    } catch (error) {
      console.error('Error fetching card details:', error);
      showAlert('Failed to fetch card details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldName, value) => {
    // ✅ Only allow changes if user has permission and card is today
    if (!hasPermission || !cardDetails?.is_today) {
      return;
    }

    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    socketService.emitFieldChange(cardId, fieldName, value, userId, userName, userEmail);
  };

  // ✅ FIXED: Save handler - NO cardDetails update!
  const handleSaveContent = async () => {
    // Permission check before saving
    if (!hasPermission) {
      showAlert('You do not have permission to edit this card', 'error');
      return;
    }

    if (!cardDetails?.is_today) {
      showAlert('You can only edit today\'s card', 'warning');
      return;
    }

    setSaving(true);
    try {
      const response = await api.put(`/faculty/daily-card/card/${cardId}/content`, {
        content: formData
      });

      if (response.data.success) {
        // ✅ Clear draft only - DON'T update cardDetails!
        const draftKey = `faculty_card_draft_${cardId}`;
        localStorage.removeItem(draftKey);
        console.log('🗑️ Faculty: Cleared draft from localStorage');

        // ✅ Show collaboration message if available
        if (response.data.collaboration) {
          const severity = response.data.collaboration.type === 'override' ? 'warning' : 'success';
          showAlert(response.data.collaboration.message, severity);
        } else {
          showAlert('Content saved successfully', 'success');
        }
      }
    } catch (error) {
      console.error('Error saving content:', error);
      const errorMsg = error.response?.data?.error || 'Failed to save content';

      if (error.response?.status === 403) {
        setHasPermission(false);
        showAlert('Permission denied. Contact admin to grant access.', 'error');
      } else {
        showAlert(errorMsg, 'error');
      }
    } finally {
      setSaving(false); // ✅ Always reset saving state
    }
  };

  const handleClearDraft = () => {
    if (confirm('Are you sure you want to clear the unsaved draft?')) {
      const draftKey = `faculty_card_draft_${cardId}`;
      localStorage.removeItem(draftKey);

      fetchCardDetails();
      showAlert('Draft cleared', 'success');
    }
  };

  useEffect(() => {
    if (!checkingPermission) {
      fetchCardDetails();
    }
  }, [cardId, checkingPermission]);

  const renderField = (field) => {
    const value = formData[field.field_name] || '';
    const isDisabled = !cardDetails?.is_today || !hasPermission;
    const activeEditor = activeEditors[field.field_name];

    const inputClasses = `w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm ${
      isDisabled ? 'bg-gray-50 cursor-not-allowed' : ''
    } ${activeEditor ? 'border-4 animate-pulse' : 'border-gray-300'}`;

    const getInputStyle = () => {
      if (activeEditor) {
        return { borderColor: activeEditor.color };
      }
      return {};
    };

    switch (field.field_type) {
      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            disabled={isDisabled}
            placeholder={field.place_holder || `Enter ${field.label}`}
            className={inputClasses}
            style={getInputStyle()}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            disabled={isDisabled}
            placeholder={field.place_holder || `Enter ${field.label}`}
            className={inputClasses}
            style={getInputStyle()}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            disabled={isDisabled}
            placeholder={field.place_holder || `Enter ${field.label}`}
            rows={4}
            className={`${inputClasses} resize-vertical`}
            style={getInputStyle()}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            disabled={isDisabled}
            className={inputClasses}
            style={getInputStyle()}
          />
        );

      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            disabled={isDisabled}
            className={inputClasses}
            style={getInputStyle()}
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            disabled={isDisabled}
            placeholder={field.place_holder || `Enter ${field.label}`}
            className={inputClasses}
            style={getInputStyle()}
          />
        );

      case 'url':
        return (
          <input
            type="url"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            disabled={isDisabled}
            placeholder={field.place_holder || `Enter ${field.label}`}
            className={inputClasses}
            style={getInputStyle()}
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            disabled={isDisabled}
            placeholder={field.place_holder || `Enter ${field.label}`}
            className={inputClasses}
            style={getInputStyle()}
          />
        );
    }
  };

  if (loading || checkingPermission) {
    return (
      <div className="min-h-screen bg-white p-6 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isToday = cardDetails?.is_today;
  const isPast = cardDetails?.is_past;

  const draftKey = `faculty_card_draft_${cardId}`;
  const hasDraft = localStorage.getItem(draftKey) !== null;

  // ✅ Can user edit?
  const canEdit = isToday && hasPermission;

  return (
    <div className="min-h-screen bg-white p-6">
      <Alert
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        severity={alert.severity}
        message={alert.message}
        position="top"
      />

      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate(`/faculty/daily-cards/${groupId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Cards</span>
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b-2 border-gray-200">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">
                  {cardDetails?.card_title}
                </h1>
              </div>
              <p className="text-gray-600">
                {canEdit ? 'Edit card details' : 'View card details'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <Users className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">{onlineCount} online</span>
              </div>

              {canEdit && hasDraft && (
                <button
                  onClick={handleClearDraft}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold shadow-sm"
                  title="Clear unsaved draft"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Draft
                </button>
              )}

              {/* ✅ Save button ALWAYS visible when canEdit is true */}
              {canEdit && (
                <button
                  onClick={handleSaveContent}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Details
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* ✅ Permission denied warning */}
          {isToday && !hasPermission && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <Lock className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-900 font-semibold">
                  You do not have permission to edit this card
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Contact the admin to request edit access
                </p>
              </div>
            </div>
          )}

          {isPast && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-900">
                This is a past date card. Details are read-only.
              </p>
            </div>
          )}

          {canEdit && hasDraft && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                <strong>Unsaved draft loaded.</strong> Your changes are auto-saved locally. Click "Save Details" to save permanently.
              </p>
            </div>
          )}

          {isToday && onlineCount > 1 && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <Users className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900">
                <strong>{onlineCount} users</strong> are viewing this card. Changes made by others will appear in real-time with colored highlights.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Card Details</h2>

          {fieldMetadata.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No fields configured</p>
              <p className="text-gray-400 text-sm mt-1">Contact admin to add fields</p>
            </div>
          ) : (
            <div className="space-y-6">
              {fieldMetadata.map((field) => {
                const activeEditor = activeEditors[field.field_name];

                return (
                  <div key={field.id}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {field.label}
                      {field.is_required && <span className="text-red-500 ml-1">*</span>}
                      {activeEditor && (
                        <span
                          className="ml-2 px-2 py-1 text-xs font-bold rounded animate-pulse"
                          style={{
                            backgroundColor: activeEditor.color + '20',
                            color: activeEditor.color,
                            border: `1px solid ${activeEditor.color}`
                          }}
                        >
                          ✏️ {activeEditor.displayName} is editing
                        </span>
                      )}
                    </label>
                    {renderField(field)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyCardContent;
