import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import api from '../../utils/axios';
import Alert from '../../components/alert/Alert';

const FacultyCardContent = () => {
  const { groupId, cardId } = useParams();
  const navigate = useNavigate();
  const [cardDetails, setCardDetails] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [alert, setAlert] = useState({
    isOpen: false,
    severity: 'success',
    message: ''
  });

  const showAlert = (message, severity = 'success') => {
    setAlert({ isOpen: true, severity, message });
  };

  const fetchCardDetails = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/faculty/daily-card/card/${cardId}`);
      if (response.data.success) {
        setCardDetails(response.data.card);
        setContent(response.data.card.card_content || '');
      }
    } catch (error) {
      console.error('Error fetching card details:', error);
      showAlert('Failed to fetch card details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContent = async () => {
    setSaving(true);
    try {
      const response = await api.put(`/faculty/daily-card/card/${cardId}/content`, { content });
      if (response.data.success) {
        showAlert('Content saved successfully', 'success');
        setCardDetails(response.data.card);
      }
    } catch (error) {
      console.error('Error saving content:', error);
      const errorMsg = error.response?.data?.error || 'Failed to save content';
      showAlert(errorMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchCardDetails();
  }, [cardId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isToday = cardDetails?.is_today;
  const isPast = cardDetails?.is_past;

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
        {/* Header */}
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
                {isToday ? 'Edit card content' : 'View card content'}
              </p>
            </div>
            {isToday && (
              <button
                onClick={handleSaveContent}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Content
                  </>
                )}
              </button>
            )}
          </div>

          {/* Permission Notice */}
          {isPast && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-900">
                This is a past date card. Content is read-only.
              </p>
            </div>
          )}
        </div>

        {/* Content Editor */}
        <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Card Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={!isToday}
            placeholder={isToday ? "Enter card content here..." : "No content available"}
            rows={15}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm resize-vertical disabled:bg-gray-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-2">
            {content.length} characters
          </p>
        </div>
      </div>
    </div>
  );
};

export default FacultyCardContent;
