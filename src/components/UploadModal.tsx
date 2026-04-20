import { useState, useRef } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { classifyImage, uploadClothingItem } from '../api/client';
import { validateImageFile } from '../api/normalizers';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (item: any) => void;
}

export function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classified, setClassified] = useState(false);
  const [classification, setClassification] = useState({
    type: '',
    category: '',
    color: '',
    pattern: '',
    fabric: '',
    fit: '',
    occasion: '',
    season: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        validateImageFile(file);
      } catch (validationError: any) {
        setError(validationError?.message || 'Invalid image file.');
        return;
      }

      setSelectedFile(file);
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      try {
        validateImageFile(file);
      } catch (validationError: any) {
        setError(validationError?.message || 'Invalid image file.');
        return;
      }

      setSelectedFile(file);
      setError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

    const handleClassify = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      setError(null);
        const result = await classifyImage(selectedFile);
        setClassification({
          type: result.type || '',
          category: result.category || '',
          color: result.color || '',
          pattern: result.pattern || '',
          fabric: result.fabric || '',
          fit: result.fit || '',
          occasion: result.occasion || '',
          season: result.season || '',
        });
        setClassified(true);
    } catch (err: any) {
        setError(err.message || 'Failed to classify item');
    } finally {
      setLoading(false);
    }
  };

    const handleSave = async () => {
      if (!selectedFile) return;

      try {
        setSaving(true);
        setError(null);
        const data = await uploadClothingItem(selectedFile, classification);
        onSuccess(data);
        handleClose();
      } catch (err: any) {
        setError(err.message || 'Failed to save item');
      } finally {
        setSaving(false);
      }
    };

    const handleFieldChange = (field: string, value: string) => {
      setClassification((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
      setClassified(false);
      setClassification({
        type: '',
        category: '',
        color: '',
        pattern: '',
        fabric: '',
        fit: '',
        occasion: '',
        season: '',
      });
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full max-h-[85vh] overflow-y-auto ${
        classified ? 'max-w-2xl' : 'max-w-md'
      }`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">Upload Clothing Item</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!preview ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-colors"
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">Drag and drop an image here</p>
              <p className="text-sm text-gray-400">or click to select a file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div>
                {classified ? (
                  <div className="flex gap-6">
                    {/* Left: Image */}
                    <div className="flex-shrink-0">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-60 h-96 object-cover rounded-lg"
                      />
                    </div>

                    {/* Right: Form Fields */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 mb-4">Edit Classification</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                          <input
                            type="text"
                            value={classification.type}
                            onChange={(e) => handleFieldChange('type', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. T-Shirt"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                          <input
                            type="text"
                            value={classification.category}
                            onChange={(e) => handleFieldChange('category', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. Topwear"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                          <input
                            type="text"
                            value={classification.color}
                            onChange={(e) => handleFieldChange('color', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. Navy Blue"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
                          <input
                            type="text"
                            value={classification.pattern}
                            onChange={(e) => handleFieldChange('pattern', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. Solid"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fabric</label>
                          <input
                            type="text"
                            value={classification.fabric}
                            onChange={(e) => handleFieldChange('fabric', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. Cotton"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Fit</label>
                          <input
                            type="text"
                            value={classification.fit}
                            onChange={(e) => handleFieldChange('fit', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. Slim"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Occasion</label>
                          <input
                            type="text"
                            value={classification.occasion}
                            onChange={(e) => handleFieldChange('occasion', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. Casual"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
                          <input
                            type="text"
                            value={classification.season}
                            onChange={(e) => handleFieldChange('season', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. Summer"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 border-t border-gray-200 pt-4">
                        <button
                          onClick={() => {
                            setClassified(false);
                            setClassification({
                              type: '',
                              category: '',
                              color: '',
                              pattern: '',
                              fabric: '',
                              fit: '',
                              occasion: '',
                              season: '',
                            });
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Reclassify
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save to Wardrobe'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
              ) : (
                  <div>
                    <div className="mb-4">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-96 object-cover rounded-lg"
                      />
                    </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreview(null);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Change
                  </button>
                  <button
                    onClick={handleClassify}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Classifying...
                      </>
                    ) : (
                        'Classify'
                    )}
                  </button>
                </div>
                  </div>
              )}

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
