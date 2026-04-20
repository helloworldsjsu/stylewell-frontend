import { getItemSlot } from '../lib/wardrobeSlots';
import type { ClothingItem, WardrobeSlot } from '../types/wardrobe';

interface WardrobeGridProps {
  items: ClothingItem[];
  selectedId?: string;
  onSelect: (item: ClothingItem) => void;
  filterType?: WardrobeSlot;
}

export function WardrobeGrid({ items, selectedId, onSelect, filterType }: WardrobeGridProps) {
  const filteredItems = filterType ? items.filter((item) => getItemSlot(item) === filterType) : items;

  if (filteredItems.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
        No items available for this section.
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto pr-1">
      <div className="grid grid-cols-3 gap-2">
        {filteredItems.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className={`rounded-xl border-2 p-1 text-left transition ${
                isSelected ? 'border-amber-500 ring-2 ring-amber-200' : 'border-slate-200 hover:border-slate-400'
              }`}
            >
              <img
                src={item.image_url}
                alt={`${item.color} ${item.category}`}
                loading="lazy"
                className="h-24 w-full rounded-lg bg-slate-100 p-1 object-contain"
              />
              <p className="mt-1 truncate text-xs font-medium text-slate-700">{item.category}</p>
              <p className="truncate text-[11px] capitalize text-slate-500">{item.color}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
