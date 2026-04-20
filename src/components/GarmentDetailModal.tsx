import { X, Edit2, Save } from 'lucide-react';
import { useState } from 'react';
import { updateClothingItem } from '../api/client';

interface GarmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updatedItem: any) => void;
  item: {
    id: string;
    type: string;
    category: string;
    color: string;
    pattern: string;
    fabric: string;
    fit: string;
    occasion: string;
    season: string;
    image_url: string;
    created_at: string;
  } | null;
}

export function GarmentDetailModal({ isOpen, onClose, onUpdate, item }: GarmentDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedData, setEditedData] = useState({
    type: '',
    category: '',
    color: '',
    pattern: '',
    fabric: '',
    fit: '',
    occasion: '',
    season: '',
  });

  if (!isOpen || !item) return null;

  const handleEdit = () => {
    setEditedData({
      type: item.type,
      category: item.category,
      color: item.color,
      pattern: item.pattern,
      fabric: item.fabric,
      fit: item.fit,
      occasion: item.occasion,
      season: item.season,
    });
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const updated = await updateClothingItem(item.id, editedData);
      const updatedDescription =
        updated.description && typeof updated.description === 'object' && !Array.isArray(updated.description)
          ? (updated.description as Record<string, unknown>)
          : {};
      if (onUpdate) {
        onUpdate({
          ...item,
          category: String(updatedDescription.category || editedData.category),
          type: String(updatedDescription.type || editedData.type),
          color: String(updatedDescription.color || editedData.color),
          pattern: String(updatedDescription.pattern || editedData.pattern),
          fabric: String(updatedDescription.fabric || editedData.fabric),
          fit: String(updatedDescription.fit || editedData.fit),
          occasion: String(updatedDescription.occasion || editedData.occasion),
          season: String(updatedDescription.season || editedData.season),
          image_url: updated.image_url || item.image_url,
          created_at: updated.created_at || item.created_at,
        });
      }
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update item');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold">{item.type} Details</h2>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={handleEdit}
                className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Image - Top on Mobile, Left on Desktop */}
            <div className="w-full md:flex-shrink-0 md:w-80">
              <img
                src={item.image_url}
                alt={item.type}
                className="w-full h-80 object-contain rounded-lg bg-gray-100"
              />
            </div>

            {/* Details - Bottom on Mobile, Right on Desktop */}
            <div className="w-full md:flex-1 md:min-w-0">
              {error && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-800">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {/* Type */}
                <div className="border border-blue-200 rounded p-2 bg-blue-50">
                  <label className="block text-xs font-semibold text-blue-900 uppercase mb-0.5">
                    Type
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.type}
                      onChange={(e) => handleFieldChange('type', e.target.value)}
                      className="w-full text-sm font-medium text-gray-900 bg-white border border-blue-300 rounded px-1.5 py-0.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{item.type}</p>
                  )}
                </div>

                {/* Category */}
                <div className="border border-purple-200 rounded p-2 bg-purple-50">
                  <label className="block text-xs font-semibold text-purple-900 uppercase mb-0.5">
                    Category
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.category}
                      onChange={(e) => handleFieldChange('category', e.target.value)}
                      className="w-full text-sm font-medium text-gray-900 bg-white border border-purple-300 rounded px-1.5 py-0.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{item.category}</p>
                  )}
                </div>

                {/* Color */}
                <div className="border border-pink-200 rounded p-2 bg-pink-50">
                  <label className="block text-xs font-semibold text-pink-900 uppercase mb-0.5">
                    Color
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.color}
                      onChange={(e) => handleFieldChange('color', e.target.value)}
                      className="w-full text-sm font-medium text-gray-900 bg-white border border-pink-300 rounded px-1.5 py-0.5 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{item.color}</p>
                  )}
                </div>

                {/* Pattern */}
                <div className="border border-green-200 rounded p-2 bg-green-50">
                  <label className="block text-xs font-semibold text-green-900 uppercase mb-0.5">
                    Pattern
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.pattern}
                      onChange={(e) => handleFieldChange('pattern', e.target.value)}
                      className="w-full text-sm font-medium text-gray-900 bg-white border border-green-300 rounded px-1.5 py-0.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{item.pattern}</p>
                  )}
                </div>

                {/* Fabric */}
                <div className="border border-yellow-200 rounded p-2 bg-yellow-50">
                  <label className="block text-xs font-semibold text-yellow-900 uppercase mb-0.5">
                    Fabric
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.fabric}
                      onChange={(e) => handleFieldChange('fabric', e.target.value)}
                      className="w-full text-sm font-medium text-gray-900 bg-white border border-yellow-300 rounded px-1.5 py-0.5 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{item.fabric}</p>
                  )}
                </div>

                {/* Fit */}
                <div className="border border-indigo-200 rounded p-2 bg-indigo-50">
                  <label className="block text-xs font-semibold text-indigo-900 uppercase mb-0.5">
                    Fit
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.fit}
                      onChange={(e) => handleFieldChange('fit', e.target.value)}
                      className="w-full text-sm font-medium text-gray-900 bg-white border border-indigo-300 rounded px-1.5 py-0.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{item.fit}</p>
                  )}
                </div>

                {/* Occasion */}
                <div className="border border-orange-200 rounded p-2 bg-orange-50">
                  <label className="block text-xs font-semibold text-orange-900 uppercase mb-0.5">
                    Occasion
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.occasion}
                      onChange={(e) => handleFieldChange('occasion', e.target.value)}
                      className="w-full text-sm font-medium text-gray-900 bg-white border border-orange-300 rounded px-1.5 py-0.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{item.occasion}</p>
                  )}
                </div>

                {/* Season */}
                <div className="border border-cyan-200 rounded p-2 bg-cyan-50">
                  <label className="block text-xs font-semibold text-cyan-900 uppercase mb-0.5">
                    Season
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedData.season}
                      onChange={(e) => handleFieldChange('season', e.target.value)}
                      className="w-full text-sm font-medium text-gray-900 bg-white border border-cyan-300 rounded px-1.5 py-0.5 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{item.season}</p>
                  )}
                </div>
              </div>

              {/* Added Date */}
              <div className="mt-2 text-xs text-gray-500">
                Added: {formatDate(item.created_at)}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  {saving ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      Save
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors font-medium"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
