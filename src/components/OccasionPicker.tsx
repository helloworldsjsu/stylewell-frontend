interface OccasionPickerProps {
  selected: string | null;
  onChange: (occasion: string) => void;
}

const OCCASIONS = [
  { key: 'casual', label: 'Casual', icon: '👕' },
  { key: 'interview', label: 'Interview', icon: '💼' },
  { key: 'party', label: 'Party', icon: '🎉' },
  { key: 'formal', label: 'Formal', icon: '🎩' },
  { key: 'wedding', label: 'Wedding', icon: '💒' },
];

export function OccasionPicker({ selected, onChange }: OccasionPickerProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {OCCASIONS.map((occasion) => {
        const isActive = selected === occasion.key;
        return (
          <button
            key={occasion.key}
            type="button"
            onClick={() => onChange(occasion.key)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'border-amber-500 bg-amber-50 text-amber-900'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
            }`}
          >
            <span className="mr-2" aria-hidden="true">{occasion.icon}</span>
            {occasion.label}
          </button>
        );
      })}
    </div>
  );
}
