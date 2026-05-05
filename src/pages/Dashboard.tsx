import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers3, Upload, Sparkles, TrendingUp } from 'lucide-react';
import { useWardrobeStore } from '../store/wardrobeStore';
import { getWardrobeItems } from '../api/client';
import { getItemSlot } from '../lib/wardrobeSlots';
import { OutfitCarousel } from '../components/OutfitCarousel';

export function Dashboard() {
  const { items, setItems } = useWardrobeStore();
  const [stats, setStats] = useState({
    totalItems: 0,
    topwear: 0,
    bottomwear: 0,
    others: 0,
  });

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    // Transform items to match new API structure
    const transformedItems = (items || []).map((item: any) => ({
      ...item,
      category: item.category || 'Unknown',
    }));
    
    setStats({
      totalItems: transformedItems.length,
      topwear: transformedItems.filter((item: any) => getItemSlot(item) === 'topwear').length,
      bottomwear: transformedItems.filter((item: any) => getItemSlot(item) === 'bottomwear').length,
      others: transformedItems.filter((item: any) => getItemSlot(item) === 'others').length,
    });
  }, [items]);

  const loadItems = async () => {
    try {
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
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome to your AI-powered wardrobe assistant</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Link
          to="/wardrobe"
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transition-transform hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Total Items</h3>
            <TrendingUp className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-4xl font-bold">{stats.totalItems}</p>
          <p className="text-blue-100 text-sm mt-2">Items in your wardrobe</p>
        </Link>

        <Link
          to="/wardrobe?filter=topwear"
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white transition-transform hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-green-600"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Topwear</h3>
            <Upload className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-4xl font-bold">{stats.topwear}</p>
          <p className="text-green-100 text-sm mt-2">Shirts, jackets, and more</p>
        </Link>

        <Link
          to="/wardrobe?filter=bottomwear"
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white transition-transform hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-600"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Bottomwear</h3>
            <Sparkles className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-4xl font-bold">{stats.bottomwear}</p>
          <p className="text-orange-100 text-sm mt-2">Jeans, shorts, and more</p>
        </Link>

        <Link
          to="/wardrobe?filter=others"
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white transition-transform hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-purple-600"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Others</h3>
            <Layers3 className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-4xl font-bold">{stats.others}</p>
          <p className="text-purple-100 text-sm mt-2">Footwear, bags, accessories, and more</p>
        </Link>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/wardrobe"
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-500"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg">Upload Item</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Add new clothing items to your wardrobe with AI classification
            </p>
          </Link>

          <Link
            to="/matching"
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow border-2 border-transparent hover:border-green-500"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Sparkles className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">Match Wardrobe</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Find the best outfit combinations from your wardrobe
            </p>
          </Link>
        </div>
      </div>

      <OutfitCarousel />
    </div>
  );
}
