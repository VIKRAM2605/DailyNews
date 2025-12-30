import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import api from '../../utils/axios';
import Alert from '../../components/alert/Alert';

const FieldMetadataManager = () => {
  const navigate = useNavigate();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    field_name: '',
    field_type: 'text',
    label: '',
    is_required: false,
    max_files: '',
    place_holder: ''
  });
  
  const [alert, setAlert] = useState({
    isOpen: false,
    severity: 'success',
    message: ''
  });

  const fieldTypes = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Textarea' },
    { value: 'number', label: 'Number' },
    { value: 'email', label: 'Email' },
    { value: 'url', label: 'URL' },
    { value: 'date', label: 'Date' },
    { value: 'file', label: 'File Upload' }
  ];

  const showAlert = (message, severity = 'success') => {
    setAlert({
      isOpen: true,
      severity,
      message
    });
  };

  const fetchFields = async () => {
    setLoading(true);
    try {
      const response = await api.get('/field-metadata');
      if (response.data.success) {
        setFields(response.data.fields);
      }
    } catch (error) {
      console.error('Error fetching fields:', error);
      showAlert('Failed to fetch fields', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, []);

  const resetForm = () => {
    setFormData({
      field_name: '',
      field_type: 'text',
      label: '',
      is_required: false,
      max_files: '',
      place_holder: ''
    });
    setEditingField(null);
  };

  const handleOpenModal = (field = null) => {
    if (field) {
      setEditingField(field);
      setFormData({
        field_name: field.field_name || '',
        field_type: field.field_type || 'text',
        label: field.label || '',
        is_required: field.is_required || false,
        max_files: field.max_files || '',
        place_holder: field.place_holder || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSave = async () => {
    // ✅ Validation warning
    if (!formData.field_name.trim() || !formData.field_type.trim() || !formData.label.trim()) {
      showAlert('Field name, type, and label are required', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        field_name: formData.field_name.trim(),
        field_type: formData.field_type,
        label: formData.label.trim(),
        is_required: formData.is_required,
        max_files: formData.max_files ? parseInt(formData.max_files) : null,
        place_holder: formData.place_holder.trim() || null
      };

      let response;
      if (editingField) {
        response = await api.put(`/field-metadata/${editingField.id}`, payload);
        // ✅ Success alert for edit
        if (response.data.success) {
          showAlert('Field updated successfully', 'success');
          fetchFields();
          handleCloseModal();
        }
      } else {
        response = await api.post('/field-metadata', payload);
        // ✅ Success alert for create
        if (response.data.success) {
          showAlert('Field created successfully', 'success');
          fetchFields();
          handleCloseModal();
        }
      }
    } catch (error) {
      console.error('Error saving field:', error);
      // ✅ Error alert
      showAlert(error.response?.data?.error || 'Failed to save field', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fieldId) => {
    // ✅ Native browser confirm (not alert component)
    if (!window.confirm('Are you sure you want to delete this field? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.delete(`/field-metadata/${fieldId}`);
      if (response.data.success) {
        // ✅ Success alert for delete
        showAlert('Field deleted successfully', 'success');
        fetchFields();
      }
    } catch (error) {
      console.error('Error deleting field:', error);
      // ✅ Error alert
      showAlert(error.response?.data?.error || 'Failed to delete field', 'error');
    }
  };

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
                Field Metadata Manager
              </h1>
              <p className="text-gray-600">
                {fields.length} field{fields.length !== 1 ? 's' : ''} configured
              </p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add New Field
            </button>
          </div>
        </div>

        {fields.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Plus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No fields configured yet</p>
            <p className="text-gray-400 text-sm mt-1">Click "Add New Field" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields.map((field) => (
              <div
                key={field.id}
                className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-5 hover:border-blue-300 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      {field.label}
                      {field.is_required && (
                        <span className="text-red-600 ml-1">*</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 font-mono">
                      {field.field_name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(field)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit field"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(field.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Type:</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded capitalize">
                      {field.field_type}
                    </span>
                  </div>

                  {field.field_type === 'file' && field.max_files && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Max Files:</span>
                      <span className="text-sm text-gray-900">{field.max_files}</span>
                    </div>
                  )}

                  {field.place_holder && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-600">
                        <span className="font-semibold">Placeholder:</span> {field.place_holder}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={handleCloseModal}
            ></div>

            <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden border-2 border-gray-200 animate-slideUp">
              <div className="flex items-center justify-between p-6 border-b-2 border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900">
                  {editingField ? 'Edit Field' : 'Add New Field'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[calc(85vh-140px)] overflow-y-auto">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Field Name (Internal) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.field_name}
                    onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                    placeholder="e.g., product_price"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use lowercase with underscores (e.g., product_price, card_title)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Display Label <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g., Product Price"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Field Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.field_type}
                    onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {fieldTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.field_type === 'file' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Max Files
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_files}
                      onChange={(e) => setFormData({ ...formData, max_files: e.target.value })}
                      placeholder="e.g., 5"
                      className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty for 1 file, or specify a number for multiple files
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Placeholder Text
                  </label>
                  <input
                    type="text"
                    value={formData.place_holder}
                    onChange={(e) => setFormData({ ...formData, place_holder: e.target.value })}
                    placeholder="e.g., Enter product price"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_required"
                    checked={formData.is_required}
                    onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_required" className="ml-3 text-sm font-semibold text-gray-700">
                    Required Field
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 p-6 border-t-2 border-gray-200 bg-gray-50">
                <button
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingField ? 'Update Field' : 'Create Field'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            transform: translateY(10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default FieldMetadataManager;
