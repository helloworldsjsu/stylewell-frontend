import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Loader2 } from 'lucide-react';
import { ClothingCard } from '../components/ClothingCard';
import { UploadModal } from '../components/UploadModal';
import { GarmentDetailModal } from '../components/GarmentDetailModal';
import { formatWardrobeSlotLabel, getItemSlot } from '../lib/wardrobeSlots';
import { useWardrobeStore } from '../store/wardrobeStore';
import { useOutfitStore } from '../store/outfitStore';
import { getWardrobeItems, deleteClothingItem } from '../api/client';
import type { WardrobeSlot } from '../types/wardrobe';

export function Wardrobe() {
  const { items, setItems, addItem, removeItem, loading, setLoading } = useWardrobeStore();
  const prefetchMatchingForCategory = useOutfitStore((state) => state.prefetchMatchingForCategory);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | WardrobeSlot>('all');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    const filterParam = searchParams.get('filter');
    const nextFilter =
      filterParam === 'topwear' || filterParam === 'bottomwear' || filterParam === 'others'
        ? filterParam
        : 'all';
    if (nextFilter !== filter) {
      setFilter(nextFilter);
    }
  }, [searchParams, filter]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await getWardrobeItems();
      // Transform API response to match store format
      const transformedItems = (data.items || []).map((item: any) => ({
        id: item.id,
        category: item.description?.category || 'Unknown',
        type: item.description?.type || 'Unknown',
        color: item.description?.color || 'Unknown',
        pattern: item.description?.pattern || 'Unknown',
        fabric: item.description?.fabric || 'Unknown',
        fit: item.description?.fit || 'Unknown',
        occasion: item.description?.occasion || 'Unknown',
        season: item.description?.season || 'Unknown',
        image_url: item.image_url,
        created_at: item.created_at,
      }));
      setItems(transformedItems);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const itemToDelete = items.find((item) => item.id === id);
      await deleteClothingItem(id);
      removeItem(id);
      if (itemToDelete) {
        void prefetchMatchingForCategory(getItemSlot(itemToDelete));
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
      alert('Failed to delete item');
    }
  };

  const handleItemClick = (item: any) => {
    setSelectedItem(item);
    setDetailModalOpen(true);
  };

  const handleItemUpdate = (updatedItem: any) => {
    const previousItem = items.find((item) => item.id === updatedItem.id);
    setItems(items.map(item => 
      item.id === updatedItem.id ? updatedItem : item
    ));
    setSelectedItem(updatedItem);

    if (previousItem) {
      const previousSlot = getItemSlot(previousItem);
      const nextSlot = getItemSlot(updatedItem);
      void prefetchMatchingForCategory(previousSlot);
      if (nextSlot !== previousSlot) {
        void prefetchMatchingForCategory(nextSlot);
      }
    }
  };

  const handleUploadSuccess = (item: any) => {
    const normalizedItem = {
      id: item.id,
      category: item.description?.category || 'Unknown',
      type: item.description?.type || 'Unknown',
      color: item.description?.color || 'Unknown',
      pattern: item.description?.pattern || 'Unknown',
      fabric: item.description?.fabric || 'Unknown',
      fit: item.description?.fit || 'Unknown',
      occasion: item.description?.occasion || 'Unknown',
      season: item.description?.season || 'Unknown',
      image_url: item.image_url,
      created_at: new Date().toISOString(),
    };

    addItem({
      ...normalizedItem,
    });

    void prefetchMatchingForCategory(getItemSlot(normalizedItem));
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    return getItemSlot(item) === filter;
  });
  const countBySlot = (slot: WardrobeSlot) => items.filter((item) => getItemSlot(item) === slot).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Wardrobe</h1>
          <p className="text-gray-600">Manage your clothing collection</p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="flex items-center gap-1 md:gap-2 bg-blue-600 text-white px-3 py-2 md:px-6 md:py-3 rounded-lg text-sm md:text-base hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-2xl hover:scale-110 active:scale-95"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          Add Item
        </button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          All ({items.length})
        </button>
        {(['topwear', 'bottomwear', 'others'] as WardrobeSlot[]).map((slot) => (
          <button
            key={slot}
            onClick={() => setFilter(slot)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === slot
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {formatWardrobeSlotLabel(slot)} ({countBySlot(slot)})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg mb-4">
            {filter === 'all'
              ? 'No items in your wardrobe yet'
              : `No ${formatWardrobeSlotLabel(filter)} items in your wardrobe`}
          </p>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 hover:shadow-lg hover:scale-110 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Add Your First Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <ClothingCard
              key={item.id}
              id={item.id}
              type={item.type}
              category={item.category}
              color={item.color}
              image_url={item.image_url}
              onClick={() => handleItemClick(item)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      <GarmentDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        onUpdate={handleItemUpdate}
        item={selectedItem}
      />
    </div>
  );
}
