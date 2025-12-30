import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, History, Sparkles, Upload, X, Check, Undo } from 'lucide-react';
import api from '../../utils/axios';
import Alert from '../../components/alert/Alert';

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
  
  const [alert, setAlert] = useState({
    isOpen: false,
    severity: 'success',
    message: ''
  });

  const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';
  const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001';

  const toneStyles = [
    { value: 'professional', label: 'Professional', description: 'Formal and business-like' },
    { value: 'casual', label: 'Casual', description: 'Friendly and relaxed' },
    { value: 'creative', label: 'Creative', description: 'Imaginative and unique' },
    { value: 'technical', label: 'Technical', description: 'Detailed and precise' },
    { value: 'persuasive', label: 'Persuasive', description: 'Convincing and compelling' }
  ];

  const showAlert = (message, severity = 'success') => {
    setAlert({
      isOpen: true,
      severity,
      message
    });
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
      const [cardResponse, metadataResponse, currentGenResponse, allGensResponse] = await Promise.all([
        api.get(`/daily-card/cards/${cardId}`),
        api.get(`/daily-card/field-metadata`),
        api.get(`/daily-card/cards/${cardId}/current-generation`),
        api.get(`/daily-card/cards/${cardId}/generations`)
      ]);

      if (cardResponse.data.success) {
        setCard(cardResponse.data.card);
      }
      if (metadataResponse.data.success) {
        setFieldMetadata(metadataResponse.data.fields);
      }
      
      if (!isRegenerating && currentGenResponse.data.success && currentGenResponse.data.generation) {
        setCurrentGeneration(currentGenResponse.data.generation);
        if (Object.keys(fieldValues).length === 0) {
          setFieldValues(safeParseObject(currentGenResponse.data.generation.field_values));
        }
        setSelectedStyle(currentGenResponse.data.generation.style_selected || 'professional');
      }
      
      if (allGensResponse.data.success) {
        setAllGenerations(allGensResponse.data.generations);
      }
    } catch (error) {
      console.error('Error fetching card data:', error);
      showAlert('Failed to fetch card data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const callAIService = async (fieldValues, styleSelected) => {
    try {
      console.log('🚀 Calling Python AI Service...');
      
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
        console.log('✅ AI Content Generated:', data.generated_content);
        return data.generated_content;
      } else {
        throw new Error(data.error || 'Failed to generate content');
      }
    } catch (error) {
      console.error('❌ AI Service call failed:', error);
      return {
        headline: fieldValues.card_title || 'Generated Headline',
        body_text: fieldValues.main_description || 'Generated content based on your inputs.',
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
        showAlert(`Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed for ${field.label}. Currently ${savedImagesCount} saved + ${currentFiles.length} new.`, 'warning');
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

  // ✅ Removed info alert
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
      showAlert('No generation exists yet. Please generate first.', 'warning');
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

  // ✅ Removed info alert
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

  // ✅ Removed info alert
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
            <div className="flex gap-2">
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
        </div>

        {isRegenerating && (
          <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-amber-900">🔄 Override Mode Active</p>
                <p className="text-sm text-amber-700">
                  You're editing version #{currentGeneration?.generation_number}. 
                  Edit the fields below and regenerate multiple times to refine this version. 
                  Click "Exit Override Mode" when done.
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
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedStyle === style.value
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
                {isRegenerating && <span className="text-sm text-amber-600 ml-2">(Editable in Override Mode)</span>}
              </h2>
              <div className="space-y-4">
                {fieldMetadata.map((field) => (
                  <div key={field.id}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {field.label}
                      {field.is_required && <span className="text-red-600 ml-1">*</span>}
                      {field.field_type === 'file' && (
                        <span className="text-xs text-gray-500 ml-2">
                          (Max {getMaxFiles(field)} file{getMaxFiles(field) > 1 ? 's' : ''})
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
                                      title="Remove this image"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded-b-lg truncate">
                                      {imgPath.split('/').pop()}
                                    </div>
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-green-600 text-white text-xs rounded">
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
                      <textarea
                        value={fieldValues[field.field_name] || ''}
                        onChange={(e) => setFieldValues({
                          ...fieldValues,
                          [field.field_name]: e.target.value
                        })}
                        placeholder={field.place_holder || ''}
                        rows={4}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <input
                        type={field.field_type || 'text'}
                        value={fieldValues[field.field_name] || ''}
                        onChange={(e) => setFieldValues({
                          ...fieldValues,
                          [field.field_name]: e.target.value
                        })}
                        placeholder={field.place_holder || ''}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    )}
                  </div>
                ))}
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
                        Overriding with AI...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" />
                        Override Again (Version #{currentGeneration?.generation_number})
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
                        Generating with AI...
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
                        <h3 className="font-semibold text-gray-900">AI Generated:</h3>
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
                                  console.error('Failed to load image:', getImageUrl(item.url));
                                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
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

        {showTimelineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
              onClick={() => setShowTimelineModal(false)}
            ></div>

            <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden border-2 border-gray-200 animate-slideUp">
              <div className="flex items-center justify-between p-6 border-b-2 border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900">Generation Timeline</h3>
                <button
                  onClick={() => setShowTimelineModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                        className={`p-5 rounded-lg border-2 transition-all ${
                          gen.is_current
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
                                    <span className="font-semibold capitalize">{key.replace(/_/g, ' ')}:</span> {String(value).substring(0, 100)}...
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
                            : (Array.isArray(uploadedImagesData) ? uploadedImagesData : []);
                          
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
