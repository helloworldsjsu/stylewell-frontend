import { Trash2 } from 'lucide-react';

interface ClothingCardProps {
  id: string;
  type: string;
  category: string;
  color: string;
  image_url: string;
  onClick?: () => void;
  onDelete?: (id: string) => void;
}

const COLOR_CODES: Record<string, string> = {
  red: '#FF0000',
  blue: '#0000FF',
  black: '#000000',
  white: '#FFFFFF',
  grey: '#808080',
  gray: '#808080',
  green: '#00FF00',
  yellow: '#FFFF00',
  pink: '#FFC0CB',
  brown: '#A52A2A',
  navy: '#000080',
  beige: '#F5F5DC',
  orange: '#FFA500',
};

export function ClothingCard({
  id,
  type,
  category,
  color,
  image_url,
  onClick,
  onDelete,
}: ClothingCardProps) {
  const colorCode = COLOR_CODES[color?.toLowerCase()] || '#999999';

  return (
    <div
      onClick={onClick}
      className="group relative bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 hover:shadow-xl hover:scale-105 cursor-pointer"
    >
      <div className="aspect-square overflow-hidden bg-gray-100">
        <img
          src={image_url}
          alt={type}
          className="w-full h-full object-contain p-2"
        />
      </div>

      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-semibold">
        {type}
      </div>

      <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md">
        <div
          className="w-3 h-3 rounded-full border border-gray-300"
          style={{ backgroundColor: colorCode }}
        />
        <span className="text-xs font-medium capitalize">{color}</span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium">
            {category}
          </span>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(id);
              }}
              className="p-1.5 bg-red-500 hover:bg-red-600 rounded-md transition-colors"
            >
              <Trash2 className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
