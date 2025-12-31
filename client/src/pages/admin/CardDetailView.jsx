import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  History,
  Sparkles,
  Upload,
  X,
  Check,
  Undo,
  RotateCcw,
  Users,
  Share2,
  Mail,
  Trash2,
  AlertCircle
} from 'lucide-react';
import api from '../../utils/axios';
import Alert from '../../components/alert/Alert';
import socketService from '../../utils/socketService';

const CardDetailView = () => {
  const { groupId, cardId } = useParams();
  const navigate = useNavigate();
  const [card, setCard] = useState(null);
  const [fieldMetadata, setFieldMetadata] = useState([]);
  const [fieldValues, setFieldValues] = useState({});

  const [fileFields, setFileFields] = useState({});
  const [filePreviewUrls, setFilePreviewUrls] = useState({});
  const [deletedImages, setDeletedImages] = useState({});

  const [currentGeneration, setCurrentGeneration] = useState(null);
  const [allGenerations, setAllGenerations] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('professional');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingGenerationId, setRegeneratingGenerationId] = useState(null);

  const [onlineCount, setOnlineCount] = useState(1);
  const [activeEditors, setActiveEditors] = useState({});

  const [showShareModal, setShowShareModal] = useState(false);
  const [sharedUsers, setSharedUsers] = useState([]);
  const [shareEmail, setShareEmail] = useState('');
  const [sharingLoading, setSharingLoading] = useState(false);

  const [availableUsers, setAvailableUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedUserIndex, setSelectedUserIndex] = useState(-1);
  const dropdownRef = useRef(null);

  const [alert, setAlert] = useState({
    isOpen: false,
    severity: 'success',
    message: ''
  });

  const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';
  const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001';

  const userId = localStorage.getItem('userId') || '1';
  const userName = localStorage.getItem('userName') || 'Admin User';
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

  const toneStyles = [
    { value: 'professional', label: 'Professional', description: 'Formal and business-like' },
    { value: 'casual', label: 'Casual', description: 'Friendly and relaxed' },
    { value: 'creative', label: 'Creative', description: 'Imaginative and unique' },
    { value: 'technical', label: 'Technical', description: 'Detailed and precise' },
    { value: 'persuasive', label: 'Persuasive', description: 'Convincing and compelling' }
  ];

  const showAlert = (message, severity = 'success') => {
    setAlert({ isOpen: true, severity, message });
  };

  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${BACKEND_URL}${path}`;
  };

  const safeParseArray = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  };

  const safeParseObject = (data) => {
    if (!data) return {};
    if (typeof data === 'object' && !Array.isArray(data)) return data;
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  };

  // Load draft from localStorage - ONLY in normal mode (not override mode)
  useEffect(() => {
    // Don't load draft in override mode
    if (isRegenerating) {
      console.log('📝 Draft disabled in override mode');
      return;
    }

    const draftKey = `admin_card_draft_${cardId}`;
    const savedDraft = localStorage.getItem(draftKey);

    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setFieldValues(draft.fieldValues || {});
        setSelectedStyle(draft.selectedStyle || 'professional');
        console.log('✅ Admin:  Loaded draft');
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, [cardId, isRegenerating]);

  // Auto-save draft - ONLY in normal mode (not override mode)
  useEffect(() => {
    if (Object.keys(fieldValues).length === 0) return;

    // Don't auto-save draft in override mode
    if (isRegenerating) {
      console.log('📝 Auto-save disabled in override mode');
      return;
    }

    const draftKey = `admin_card_draft_${cardId}`;
    const draft = {
      fieldValues,
      selectedStyle,
      timestamp: new Date().toISOString()
    };

    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [fieldValues, selectedStyle, cardId, isRegenerating]);

  // Socket. IO initialization - DISABLED in override mode
  useEffect(() => {
    // Disable sockets in override mode
    if (isRegenerating) {
      console.log('🔌 Sockets disabled in override mode');
      socketService.removeAllListeners();
      socketService.disconnect();
      return;
    }

    console.log('🔌 Admin:  Initializing socket.. .');

    const socket = socketService.connect();
    socketService.joinCard(cardId, userId, userName, userEmail);

    socketService.onRoomUserCount(({ count }) => {
      setOnlineCount(count);
    });

    socketService.onFieldUpdated(({ fieldName, value, userId: editorId, userName: updaterName, userEmail: updaterEmail }) => {
      setFieldValues(prev => ({ ...prev, [fieldName]: value }));

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
  }, [cardId, userId, userName, userEmail, isRegenerating]);

  useEffect(() => {
    return () => {
      Object.values(filePreviewUrls).forEach(urls => {
        if (Array.isArray(urls)) {
          urls.forEach(url => URL.revokeObjectURL(url));
        } else if (urls) {
          URL.revokeObjectURL(urls);
        }
      });
    };
  }, []);

  const fetchCardData = async () => {
    setLoading(true);
    try {
      const [cardResponse, metadataResponse, allGensResponse] = await Promise.all([
        api.get(`/daily-card/cards/${cardId}`),
        api.get('/daily-card/field-metadata'),
        api.get(`/daily-card/cards/${cardId}/generations`)
      ]);

      if (cardResponse.data.success) {
        setCard(cardResponse.data.card);
      }

      if (metadataResponse.data.success) {
        setFieldMetadata(metadataResponse.data.fields);
      }

      if (allGensResponse.data.success) {
        setAllGenerations(allGensResponse.data.generations);
      }

      const draftKey = `admin_card_draft_${cardId}`;
      const savedDraft = localStorage.getItem(draftKey);

      if (!isRegenerating && !savedDraft) {
        const currentGen = cardResponse.data.current_generation;
        const cardContent = cardResponse.data.card?.card_content || {};

        if (currentGen) {
          setCurrentGeneration(currentGen);
          setFieldValues(safeParseObject(currentGen.field_values) || {});
          setSelectedStyle(currentGen.style_selected || 'professional');
        } else if (Object.keys(cardContent).length > 0) {
          setFieldValues(cardContent);
          setCurrentGeneration(null);
          setSelectedStyle('professional');
        } else {
          setFieldValues({});
          setCurrentGeneration(null);
          setSelectedStyle('professional');
        }
      }

    } catch (error) {
      console.error('Error fetching card data:', error);
      showAlert('Failed to fetch card data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSharedUsers = async () => {
    try {
      const response = await api.get(`/daily-card/cards/${cardId}/permissions`);
      if (response.data.success) {
        setSharedUsers(response.data.permissions);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await api.get(`/daily-card/cards/${cardId}/available-users`);
      if (response.data.success) {
        setAvailableUsers(response.data.users);
        setFilteredUsers(response.data.users);
      }
    } catch (error) {
      console.error('Failed to fetch available users:', error);
    }
  };

  const handleEmailInputChange = (value) => {
    setShareEmail(value);

    if (value.trim() === '') {
      setFilteredUsers(availableUsers);
      setShowUserDropdown(false);
      return;
    }

    const filtered = availableUsers.filter(user =>
      user.email.toLowerCase().includes(value.toLowerCase()) ||
      user.name.toLowerCase().includes(value.toLowerCase())
    );

    setFilteredUsers(filtered);
    setShowUserDropdown(filtered.length > 0);
    setSelectedUserIndex(-1);
  };

  const handleSelectUser = (user) => {
    setShareEmail(user.email);
    setShowUserDropdown(false);
    setSelectedUserIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showUserDropdown || filteredUsers.length === 0) {
      if (e.key === 'Enter') {
        handleGrantAccess();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedUserIndex(prev =>
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedUserIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedUserIndex >= 0 && selectedUserIndex < filteredUsers.length) {
          handleSelectUser(filteredUsers[selectedUserIndex]);
        } else {
          handleGrantAccess();
        }
        break;
      case 'Escape':
        setShowUserDropdown(false);
        setSelectedUserIndex(-1);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
        setSelectedUserIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showShareModal) {
      fetchSharedUsers();
      fetchAvailableUsers();
    } else {
      setShareEmail('');
      setShowUserDropdown(false);
      setSelectedUserIndex(-1);
    }
  }, [showShareModal]);

  const handleGrantAccess = async () => {
    if (!shareEmail.trim()) {
      showAlert('Please enter an email address', 'warning');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shareEmail)) {
      showAlert('Please enter a valid email address', 'warning');
      return;
    }

    setSharingLoading(true);
    try {
      const response = await api.post(`/daily-card/cards/${cardId}/grant-access`, {
        user_email: shareEmail
      });

      if (response.data.success) {
        showAlert(response.data.message, 'success');
        setShareEmail('');
        setShowUserDropdown(false);
        fetchSharedUsers();
        fetchAvailableUsers();
      }
    } catch (error) {
      console.error('Grant access error:', error);
      showAlert(error.response?.data?.error || 'Failed to grant access', 'error');
    } finally {
      setSharingLoading(false);
    }
  };

  const handleRevokeAccess = async (userId) => {
    if (!confirm('Are you sure you want to revoke access for this user?')) {
      return;
    }

    try {
      const response = await api.delete(`/daily-card/cards/${cardId}/revoke-access/${userId}`);

      if (response.data.success) {
        showAlert('Access revoked successfully', 'success');
        fetchSharedUsers();
        fetchAvailableUsers();
      }
    } catch (error) {
      console.error('Revoke access error:', error);
      showAlert(error.response?.data?.error || 'Failed to revoke access', 'error');
    }
  };

const handleRevertToOriginal = () => {
  const cardContent = card?. card_content || {};

  if (Object.keys(cardContent).length === 0) {
    showAlert('No original content to revert to', 'warning');
    return;
  }

  setFieldValues(cardContent);
  setSelectedStyle('professional');
  
  // Don't reset these if in override mode - stay in override mode
  if (!isRegenerating) {
    setCurrentGeneration(null);
  }
  
  // Don't exit override mode - keep isRegenerating and regeneratingGenerationId as is
  // setIsRegenerating(false);  // REMOVED
  // setRegeneratingGenerationId(null);  // REMOVED
  
  setFileFields({});
  setFilePreviewUrls({});
  setDeletedImages({});

  const draftKey = `admin_card_draft_${cardId}`;
  localStorage.removeItem(draftKey);

  showAlert('Reverted to original content', 'success');
};

  const handleClearDraft = () => {
    if (confirm('Are you sure you want to clear the unsaved draft?')) {
      const draftKey = `admin_card_draft_${cardId}`;
      localStorage.removeItem(draftKey);
      fetchCardData();
      showAlert('Draft cleared', 'success');
    }
  };

  const callAIService = async (fieldValues, styleSelected) => {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          field_values: fieldValues,
          style_selected: styleSelected
        })
      });

      if (!response.ok) {
        throw new Error(`AI Service Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        return data.generated_content;
      } else {
        throw new Error(data.error || 'Failed to generate content');
      }
    } catch (error) {
      console.error('AI Service call failed:', error);
      return {
        headline: fieldValues.card_title || 'Generated Headline',
        body_text: fieldValues.main_description || 'Generated content.',
        call_to_action: fieldValues.call_to_action || 'Learn More',
        generated_at: new Date().toISOString(),
        fallback: true
      };
    }
  };

  const getMaxFiles = (field) => {
    return field.max_files || 1;
  };

  const isMultipleFileField = (field) => {
    return getMaxFiles(field) > 1;
  };

  const handleFileUpload = (field) => (e) => {
    const files = Array.from(e.target.files);
    const fieldName = field.field_name;
    const maxFiles = getMaxFiles(field);

    if (maxFiles > 1) {
      const currentFiles = fileFields[fieldName] || [];

      const uploadedImagesData = currentGeneration?.uploaded_images || {};
      const savedImagesCount = typeof uploadedImagesData === 'object' && !Array.isArray(uploadedImagesData)
        ? (uploadedImagesData[fieldName] || []).length
        : 0;

      const totalFiles = files.length + currentFiles.length + savedImagesCount;

      if (totalFiles > maxFiles) {
        showAlert(`Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed for ${field.label}`, 'warning');
        return;
      }

      const newUrls = files.map(file => URL.createObjectURL(file));
      const currentUrls = filePreviewUrls[fieldName] || [];

      setFileFields({
        ...fileFields,
        [fieldName]: [...currentFiles, ...files]
      });

      setFilePreviewUrls({
        ...filePreviewUrls,
        [fieldName]: [...currentUrls, ...newUrls]
      });
    } else {
      if (files.length > 1) {
        showAlert(`Only 1 file allowed for ${field.label}`, 'warning');
        return;
      }

      if (filePreviewUrls[fieldName]) {
        URL.revokeObjectURL(filePreviewUrls[fieldName]);
      }

      const newUrl = URL.createObjectURL(files[0]);

      setFileFields({
        ...fileFields,
        [fieldName]: files[0]
      });

      setFilePreviewUrls({
        ...filePreviewUrls,
        [fieldName]: newUrl
      });
    }
  };

  const removeFile = (fieldName, fileIndex = null) => {
    if (fileIndex !== null) {
      const currentFiles = fileFields[fieldName] || [];
      const currentUrls = filePreviewUrls[fieldName] || [];

      if (currentUrls[fileIndex]) {
        URL.revokeObjectURL(currentUrls[fileIndex]);
      }

      setFileFields({
        ...fileFields,
        [fieldName]: currentFiles.filter((_, i) => i !== fileIndex)
      });

      setFilePreviewUrls({
        ...filePreviewUrls,
        [fieldName]: currentUrls.filter((_, i) => i !== fileIndex)
      });
    } else {
      if (filePreviewUrls[fieldName]) {
        if (Array.isArray(filePreviewUrls[fieldName])) {
          filePreviewUrls[fieldName].forEach(url => URL.revokeObjectURL(url));
        } else {
          URL.revokeObjectURL(filePreviewUrls[fieldName]);
        }
      }

      const newFileFields = { ...fileFields };
      delete newFileFields[fieldName];
      setFileFields(newFileFields);

      const newPreviewUrls = { ...filePreviewUrls };
      delete newPreviewUrls[fieldName];
      setFilePreviewUrls(newPreviewUrls);
    }
  };

  const removeSavedImage = (fieldName, imageIndex) => {
    if (!currentGeneration?.uploaded_images) return;

    const uploadedImagesData = currentGeneration.uploaded_images;

    if (typeof uploadedImagesData === 'object' && !Array.isArray(uploadedImagesData)) {
      const fieldImages = uploadedImagesData[fieldName] || [];
      const imageToDelete = fieldImages[imageIndex];

      setDeletedImages(prev => ({
        ...prev,
        [fieldName]: [...(prev[fieldName] || []), imageToDelete]
      }));
    }
  };

  const handleFieldChange = (fieldName, value) => {
    setFieldValues(prev => ({ ...prev, [fieldName]: value }));

    // Don't emit socket events in override mode
    if (!isRegenerating) {
      socketService.emitFieldChange(cardId, fieldName, value, userId, userName, userEmail);
    }
  };

  const handleGenerate = async () => {
    const missingFields = fieldMetadata
      .filter(field => field.is_required && field.field_type !== 'file' && !fieldValues[field.field_name]?.trim())
      .map(field => field.label);

    if (missingFields.length > 0) {
      showAlert(`Please fill in required fields: ${missingFields.join(', ')}`, 'warning');
      return;
    }

    setGenerating(true);
    try {
      const aiGeneratedContent = await callAIService(fieldValues, selectedStyle);

      const formData = new FormData();
      formData.append('style_selected', selectedStyle);
      formData.append('field_values', JSON.stringify(fieldValues));
      formData.append('generated_output', JSON.stringify(aiGeneratedContent));

      const existingImagesAfterDeletion = {};
      if (currentGeneration?.uploaded_images) {
        const uploadedImagesData = currentGeneration.uploaded_images;

        if (typeof uploadedImagesData === 'object' && !Array.isArray(uploadedImagesData)) {
          Object.keys(uploadedImagesData).forEach(fieldName => {
            const allImages = uploadedImagesData[fieldName] || [];
            const deletedForField = deletedImages[fieldName] || [];

            const remainingImages = allImages.filter(img => !deletedForField.includes(img));

            if (remainingImages.length > 0) {
              existingImagesAfterDeletion[fieldName] = remainingImages;
            }
          });
        }
      }

      formData.append('existing_images', JSON.stringify(existingImagesAfterDeletion));

      Object.keys(fileFields).forEach((fieldName) => {
        const fieldData = fileFields[fieldName];

        if (Array.isArray(fieldData)) {
          fieldData.forEach((file) => {
            formData.append(fieldName, file);
          });
        } else if (fieldData) {
          formData.append(fieldName, fieldData);
        }
      });

      const response = await api.post(`/daily-card/cards/${cardId}/generate`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const newGenerationFromServer = response.data.generation;

        setCurrentGeneration(newGenerationFromServer);
        setIsRegenerating(false);
        setRegeneratingGenerationId(null);

        setFileFields({});
        setFilePreviewUrls({});
        setDeletedImages({});

        // Clear draft after successful generation in normal mode
        const draftKey = `admin_card_draft_${cardId}`;
        localStorage.removeItem(draftKey);
        console.log('✅ Draft cleared after successful generation');

        const allGensResponse = await api.get(`/daily-card/cards/${cardId}/generations`);
        if (allGensResponse.data.success) {
          setAllGenerations(allGensResponse.data.generations);
        }

        showAlert('Content generated successfully!', 'success');
      }
    } catch (error) {
      console.error('Error generating content:', error);
      showAlert(error.response?.data?.error || error.message || 'Failed to generate content', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!currentGeneration) {
      showAlert('No generation exists yet', 'warning');
      return;
    }

    setGenerating(true);
    try {
      const aiGeneratedContent = await callAIService(fieldValues, selectedStyle);
      const generationIdToOverride = regeneratingGenerationId || currentGeneration.id;

      const hasNewImages = Object.keys(fileFields).length > 0;
      const hasDeletedImages = Object.keys(deletedImages).length > 0;
      const hasImageChanges = hasNewImages || hasDeletedImages;

      if (hasImageChanges) {
        const formData = new FormData();
        formData.append('style_selected', selectedStyle);
        formData.append('generated_output', JSON.stringify(aiGeneratedContent));
        formData.append('field_values', JSON.stringify(fieldValues));

        const existingImagesAfterDeletion = {};
        if (currentGeneration?.uploaded_images) {
          const uploadedImagesData = currentGeneration.uploaded_images;

          if (typeof uploadedImagesData === 'object' && !Array.isArray(uploadedImagesData)) {
            Object.keys(uploadedImagesData).forEach(fieldName => {
              const allImages = uploadedImagesData[fieldName] || [];
              const deletedForField = deletedImages[fieldName] || [];

              const remainingImages = allImages.filter(img => !deletedForField.includes(img));

              if (remainingImages.length > 0) {
                existingImagesAfterDeletion[fieldName] = remainingImages;
              }
            });
          }
        }

        formData.append('existing_images', JSON.stringify(existingImagesAfterDeletion));

        Object.keys(fileFields).forEach((fieldName) => {
          const fieldData = fileFields[fieldName];

          if (Array.isArray(fieldData)) {
            fieldData.forEach((file) => {
              formData.append(fieldName, file);
            });
          } else if (fieldData) {
            formData.append(fieldName, fieldData);
          }
        });

        const response = await api.put(
          `/daily-card/cards/${cardId}/generations/${generationIdToOverride}/with-images`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        if (response.data.success) {
          const updatedGen = response.data.generation;

          setFileFields({});
          setFilePreviewUrls({});
          setDeletedImages({});

          setCurrentGeneration(updatedGen);

          const allGensResponse = await api.get(`/daily-card/cards/${cardId}/generations`);
          if (allGensResponse.data.success) {
            setAllGenerations(allGensResponse.data.generations);
          }

          showAlert('Content regenerated successfully!', 'success');
        }
      } else {
        const response = await api.put(`/daily-card/cards/${cardId}/generations/${generationIdToOverride}`, {
          style_selected: selectedStyle,
          generated_output: aiGeneratedContent,
          field_values: fieldValues
        });

        if (response.data.success) {
          const updatedGen = response.data.generation;

          setCurrentGeneration(updatedGen);
          setAllGenerations(prevGens =>
            prevGens.map(gen => ({
              ...gen,
              is_current: gen.id === updatedGen.id,
              ...(gen.id === updatedGen.id ? {
                generated_output: updatedGen.generated_output,
                style_selected: updatedGen.style_selected,
                field_values: updatedGen.field_values,
                uploaded_images: updatedGen.uploaded_images,
                updated_at: updatedGen.updated_at
              } : {})
            }))
          );

          showAlert('Content regenerated successfully!', 'success');
        }
      }
    } catch (error) {
      console.error('Error regenerating content:', error);
      showAlert(error.response?.data?.error || error.message || 'Failed to regenerate content', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadGeneration = (generation) => {
    setCurrentGeneration(generation);
    setFieldValues(safeParseObject(generation.field_values));
    setSelectedStyle(generation.style_selected);
    setIsRegenerating(true);
    setRegeneratingGenerationId(generation.id);
    setShowTimelineModal(false);

    setFileFields({});
    setFilePreviewUrls({});
    setDeletedImages({});
  };

  const handleResetToNew = async () => {
    setIsRegenerating(false);
    setRegeneratingGenerationId(null);

    setFileFields({});
    setFilePreviewUrls({});
    setDeletedImages({});

    try {
      const currentGenResponse = await api.get(`/daily-card/cards/${cardId}/current-generation`);
      if (currentGenResponse.data.success && currentGenResponse.data.generation) {
        setCurrentGeneration(currentGenResponse.data.generation);
      }

      const allGensResponse = await api.get(`/daily-card/cards/${cardId}/generations`);
      if (allGensResponse.data.success) {
        setAllGenerations(allGensResponse.data.generations);
      }
    } catch (error) {
      console.error('Error fetching current generation:', error);
      showAlert('Failed to load current generation', 'error');
    }
  };

  useEffect(() => {
    fetchCardData();
  }, [cardId]);

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const draftKey = `admin_card_draft_${cardId}`;
  const hasDraft = !isRegenerating && localStorage.getItem(draftKey) !== null;

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
            onClick={() => navigate(`/admin/daily-cards/${groupId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Card Group</span>
          </button>

          <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b-2 border-gray-200">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {card?.card_title}
              </h1>
              <p className="text-gray-600">
                {allGenerations.length} generation{allGenerations.length !== 1 ? 's' : ''} in timeline
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {/* Only show online count in normal mode (not override) */}
              {!isRegenerating && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <Users className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-700">{onlineCount} online</span>
                </div>
              )}

              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>

              {/* Only show clear draft button in normal mode */}
              {hasDraft && (
                <button
                  onClick={handleClearDraft}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold shadow-sm"
                  title="Clear unsaved draft"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Draft
                </button>
              )}

              {/* Revert button - Always visible, but disabled in generate mode, enabled in override mode */}
              <button
                onClick={handleRevertToOriginal}
                disabled={!isRegenerating}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors font-semibold shadow-sm ${isRegenerating
                    ? 'bg-orange-600 text-white hover:bg-orange-700 cursor-pointer'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                  }`}
                title={!isRegenerating ? 'Only available in Override Mode' : 'Revert to original content'}
              >
                <RotateCcw className="w-4 h-4" />
                Revert to Original
              </button>

              {isRegenerating && (
                <button
                  onClick={handleResetToNew}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold shadow-sm"
                >
                  <Undo className="w-4 h-4" />
                  Exit Override Mode
                </button>
              )}
              <button
                onClick={() => setShowTimelineModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold shadow-sm"
              >
                <History className="w-4 h-4" />
                Timeline ({allGenerations.length})
              </button>
            </div>
          </div>

          {/* Show draft alert ONLY in normal mode */}
          {hasDraft && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">
                <strong>Unsaved draft loaded. </strong> Your changes are auto-saved locally. Generate content to save permanently.
              </p>
            </div>
          )}
        </div>

        {/* Override mode alert */}
        {isRegenerating && (
          <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-900">🔄 Override Mode Active</p>
                <p className="text-sm text-amber-700">
                  You're editing version #{currentGeneration?.generation_number}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Sockets and draft auto-save disabled in this mode
                </p>
              </div>
              <button
                onClick={handleResetToNew}
                className="text-sm text-amber-700 hover:text-amber-900 underline"
              >
                Exit
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Select Tone & Style</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {toneStyles.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setSelectedStyle(style.value)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${selectedStyle === style.value
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                      }`}
                  >
                    <h3 className="font-bold text-gray-900 mb-1">{style.label}</h3>
                    <p className="text-sm text-gray-600">{style.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Input Fields
                {isRegenerating && <span className="text-sm text-amber-600 ml-2">(Override Mode)</span>}
              </h2>
              <div className="space-y-4">
                {fieldMetadata.map((field) => {
                  const activeEditor = activeEditors[field.field_name];

                  return (
                    <div key={field.id}>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {field.label}
                        {field.is_required && <span className="text-red-600 ml-1">*</span>}
                        {field.field_type === 'file' && (
                          <span className="text-xs text-gray-500 ml-2">
                            (Max {getMaxFiles(field)} file{getMaxFiles(field) > 1 ? 's' : ''})
                          </span>
                        )}
                        {/* Only show active editor in normal mode */}
                        {activeEditor && !isRegenerating && (
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

                      {field.field_type === 'file' ? (
                        <div>
                          <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                            <Upload className="w-5 h-5 text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {field.place_holder || `Click to upload ${getMaxFiles(field) > 1 ? 'images' : 'image'}`}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple={isMultipleFileField(field)}
                              onChange={handleFileUpload(field)}
                              className="hidden"
                            />
                          </label>

                          {(() => {
                            const fieldUrls = filePreviewUrls[field.field_name];
                            const fieldFiles = fileFields[field.field_name];

                            const urlsArray = Array.isArray(fieldUrls) ? fieldUrls : (fieldUrls ? [fieldUrls] : []);
                            const filesArray = Array.isArray(fieldFiles) ? fieldFiles : (fieldFiles ? [fieldFiles] : []);

                            const uploadedImagesData = currentGeneration?.uploaded_images || {};
                            const allSavedImages = typeof uploadedImagesData === 'object' && !Array.isArray(uploadedImagesData)
                              ? (uploadedImagesData[field.field_name] || [])
                              : [];

                            const deletedForThisField = deletedImages[field.field_name] || [];
                            const savedImages = allSavedImages.filter(img => !deletedForThisField.includes(img));

                            const hasContent = urlsArray.length > 0 || savedImages.length > 0;

                            return hasContent && (
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {savedImages.map((imgPath, displayIndex) => {
                                  const originalIndex = allSavedImages.indexOf(imgPath);

                                  return (
                                    <div key={`saved-${displayIndex}`} className="relative group">
                                      <img
                                        src={getImageUrl(imgPath)}
                                        alt={`Saved ${displayIndex + 1}`}
                                        className="w-full h-24 object-cover rounded-lg border-2 border-green-400"
                                        onError={(e) => {
                                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EError%3C/text%3E%3C/svg%3E';
                                        }}
                                      />
                                      <button
                                        onClick={() => removeSavedImage(field.field_name, originalIndex)}
                                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded-b-lg truncate">
                                        {imgPath.split('/').pop()}
                                      </div>
                                      <div className="absolute top-1 left-1 px-1. 5 py-0.5 bg-green-600 text-white text-xs rounded">
                                        Current
                                      </div>
                                    </div>
                                  );
                                })}

                                {urlsArray.map((url, index) => (
                                  <div key={`new-${index}`} className="relative group">
                                    <img
                                      src={url}
                                      alt={filesArray[index]?.name || `Image ${index + 1}`}
                                      className="w-full h-24 object-cover rounded-lg border-2 border-blue-400"
                                    />
                                    <button
                                      onClick={() => removeFile(field.field_name, Array.isArray(fieldUrls) ? index : null)}
                                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded-b-lg truncate">
                                      {filesArray[index]?.name || 'New Image'}
                                    </div>
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded">
                                      New
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ) : field.field_type === 'textarea' ? (
                        <div className="relative">
                          <textarea
                            value={fieldValues[field.field_name] || ''}
                            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                            placeholder={field.place_holder || ''}
                            rows={4}
                            className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${activeEditor && !isRegenerating ? 'border-4 animate-pulse' : 'border-gray-300'
                              }`}
                            style={activeEditor && !isRegenerating ? { borderColor: activeEditor.color } : {}}
                          />
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type={field.field_type || 'text'}
                            value={fieldValues[field.field_name] || ''}
                            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                            placeholder={field.place_holder || ''}
                            className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${activeEditor && !isRegenerating ? 'border-4 animate-pulse' : 'border-gray-300'
                              }`}
                            style={activeEditor && !isRegenerating ? { borderColor: activeEditor.color } : {}}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex gap-3">
                {isRegenerating ? (
                  <button
                    onClick={handleRegenerate}
                    disabled={generating}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Overriding...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        Override Again (v#{currentGeneration?.generation_number})
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Content
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right sidebar - Current Output */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border-2 border-gray-200 p-6 sticky top-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Current Output</h2>

              {currentGeneration ? (
                <div>
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">Version</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                        #{currentGeneration.generation_number}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-700">Style</span>
                      <span className="text-sm text-gray-900 capitalize">{currentGeneration.style_selected}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">Created</span>
                      <span className="text-sm text-gray-900">{formatDateTime(currentGeneration.created_at)}</span>
                    </div>
                  </div>

                  {(() => {
                    const output = safeParseObject(currentGeneration.generated_output);
                    const outputKeys = Object.keys(output).filter(
                      key => key !== 'generated_at' && key !== 'full_text' && key !== 'fallback'
                    );

                    return outputKeys.length > 0 && (
                      <div className="space-y-3 mb-4">
                        <h3 className="font-semibold text-gray-900">AI Generated: </h3>
                        {outputKeys.map((key) => (
                          <div key={key} className="p-3 bg-green-50 rounded-lg border border-green-200">
                            <p className="text-xs font-semibold text-green-700 mb-1 capitalize">
                              {key.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{output[key] || 'N/A'}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {(() => {
                    const uploadedImagesData = currentGeneration.uploaded_images || {};

                    let allImages = [];

                    if (typeof uploadedImagesData === 'object' && !Array.isArray(uploadedImagesData)) {
                      allImages = Object.entries(uploadedImagesData).flatMap(([fieldName, urls]) =>
                        (Array.isArray(urls) ? urls : []).map(url => ({ url, fieldName }))
                      );
                    }
                    else if (Array.isArray(uploadedImagesData)) {
                      allImages = uploadedImagesData.map(url => ({ url, fieldName: 'uploaded' }));
                    }

                    return allImages.length > 0 && (
                      <div className="mb-4">
                        <h3 className="font-semibold text-gray-900 mb-2">Images ({allImages.length}):</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {allImages.map((item, index) => (
                            <div key={index} className="relative">
                              <img
                                src={getImageUrl(item.url)}
                                alt={`${item.fieldName} ${index + 1}`}
                                className="w-full h-20 object-cover rounded-lg border border-gray-200"
                                onError={(e) => {
                                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=". 3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                                }}
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded-b-lg truncate">
                                {item.fieldName}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const fieldVals = safeParseObject(currentGeneration.field_values);
                    const fieldKeys = Object.keys(fieldVals);

                    return fieldKeys.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-semibold text-gray-900">Input Data:</h3>
                        {fieldKeys.map((key) => (
                          <div key={key} className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs font-semibold text-gray-600 mb-1 capitalize">
                              {key.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm text-gray-900">{fieldVals[key] || 'N/A'}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No output generated yet</p>
                  <p className="text-gray-400 text-sm mt-1">Fill in the fields and generate content</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowShareModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full border-2 border-gray-200 animate-slideUp">
              <div className="flex items-center justify-between p-6 border-b-2 border-gray-200">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Share Card</h3>
                  <p className="text-sm text-gray-600 mt-1">Grant edit access to others</p>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Search Users by Name or Email
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative" ref={dropdownRef}>
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                      <input
                        type="text"
                        value={shareEmail}
                        onChange={(e) => handleEmailInputChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                          if (shareEmail.trim() !== '' && filteredUsers.length > 0) {
                            setShowUserDropdown(true);
                          }
                        }}
                        placeholder="Type to search users..."
                        className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />

                      {showUserDropdown && filteredUsers.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredUsers.map((user, index) => (
                            <button
                              key={user.id}
                              onClick={() => handleSelectUser(user)}
                              className={`w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0 ${index === selectedUserIndex ? 'bg-blue-50' : ''
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                  <span className="text-blue-600 font-semibold text-sm">
                                    {user.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900 truncate">{user.name}</p>
                                  <p className="text-sm text-gray-600 truncate">{user.email}</p>
                                </div>
                                {user.role && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded font-medium">
                                    {user.role}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {showUserDropdown && filteredUsers.length === 0 && shareEmail.trim() !== '' && (
                        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-4">
                          <p className="text-sm text-gray-500 text-center">No users found</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleGrantAccess}
                      disabled={sharingLoading}
                      className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled: opacity-50 disabled:cursor-not-allowed"
                    >
                      {sharingLoading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        'Add'
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    💡 Tip: Use ↑↓ to navigate, Enter to select
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Shared With ({sharedUsers.length})
                  </h4>
                  {sharedUsers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No users yet</p>
                      <p className="text-gray-400 text-sm mt-1">Search and add someone above</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {sharedUsers.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-green-600 font-semibold text-sm">
                                {permission.user_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{permission.user_name}</p>
                              <p className="text-sm text-gray-600 truncate">{permission.user_email}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Added by {permission.granted_by_name} • {new Date(permission.granted_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevokeAccess(permission.user_id)}
                            className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                            title="Revoke access"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t-2 border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-full px-4 py-2. 5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Modal */}
        {showTimelineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowTimelineModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden border-2 border-gray-200 animate-slideUp">
              <div className="flex items-center justify-between p-6 border-b-2 border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900">Generation Timeline</h3>
                <button
                  onClick={() => setShowTimelineModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover: bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(85vh-100px)]">
                {allGenerations.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No generations yet</p>
                    <p className="text-gray-400 text-sm mt-1">Start by generating your first content</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allGenerations.map((gen) => (
                      <div
                        key={gen.id}
                        className={`p-5 rounded-lg border-2 transition-all ${gen.is_current
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                          }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                              #{gen.generation_number}
                            </span>
                            <span className="text-sm font-semibold text-gray-900 capitalize">
                              {gen.style_selected}
                            </span>
                            {gen.is_current && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">
                              {formatDateTime(gen.created_at)}
                            </span>
                            <button
                              onClick={() => handleLoadGeneration(gen)}
                              className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors font-medium"
                            >
                              Load & Override
                            </button>
                          </div>
                        </div>

                        {(() => {
                          const output = safeParseObject(gen.generated_output);
                          const outputEntries = Object.entries(output)
                            .filter(([key]) => key !== 'generated_at' && key !== 'full_text' && key !== 'fallback')
                            .slice(0, 2);

                          return outputEntries.length > 0 && (
                            <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
                              <p className="text-xs font-semibold text-green-700 mb-2">AI Output:</p>
                              <div className="space-y-1">
                                {outputEntries.map(([key, value]) => (
                                  <p key={key} className="text-xs text-gray-700">
                                    <span className="font-semibold capitalize">{key.replace(/_/g, ' ')}:  </span>
                                    {String(value).substring(0, 100)}...
                                  </p>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {(() => {
                          const fieldVals = safeParseObject(gen.field_values);
                          const fieldEntries = Object.entries(fieldVals).slice(0, 4);

                          return fieldEntries.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {fieldEntries.map(([key, value]) => (
                                <div key={key} className="p-2 bg-white rounded border border-gray-200">
                                  <p className="text-xs text-gray-600 mb-1 capitalize">
                                    {key.replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-sm text-gray-900 truncate">{value || 'N/A'}</p>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                        {(() => {
                          const uploadedImagesData = gen.uploaded_images || {};
                          const allImages = typeof uploadedImagesData === 'object' && !Array.isArray(uploadedImagesData)
                            ? Object.values(uploadedImagesData).flat()
                            : Array.isArray(uploadedImagesData)
                              ? uploadedImagesData
                              : [];

                          return allImages.length > 0 && (
                            <div className="mt-3 flex gap-2">
                              {allImages.slice(0, 3).map((imgPath, idx) => (
                                <img
                                  key={idx}
                                  src={getImageUrl(imgPath)}
                                  alt={`Gen ${gen.generation_number} img ${idx + 1}`}
                                  className="w-16 h-16 object-cover rounded border border-gray-200"
                                  onError={(e) => {
                                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3E❌%3C/text%3E%3C/svg%3E';
                                  }}
                                />
                              ))}
                              {allImages.length > 3 && (
                                <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded border border-gray-200 text-xs text-gray-600">
                                  +{allImages.length - 3}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
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

export default CardDetailView;