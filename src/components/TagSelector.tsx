import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

interface TagSelectorProps {
  selectedTags: string[];
  availableTags: string[];
  onChange: (tags: string[]) => void;
  onCreateTag?: (tag: string) => Promise<void> | void;
  label?: string;
  placeholder?: string;
}

export default function TagSelector({
  selectedTags,
  availableTags,
  onChange,
  onCreateTag,
  label = 'Flavor Tags',
  placeholder = 'Type a tag and press Enter'
}: TagSelectorProps) {
  const [query, setQuery] = useState('');

  const normalizedSelected = useMemo(
    () => selectedTags.map((tag) => tag.toLowerCase()),
    [selectedTags]
  );

  const suggestions = useMemo(() => {
    const base = availableTags.filter((tag) => !normalizedSelected.includes(tag.toLowerCase()));
    if (!query.trim()) return base.slice(0, 10);
    return base
      .filter((tag) => tag.toLowerCase().includes(query.trim().toLowerCase()))
      .slice(0, 10);
  }, [availableTags, normalizedSelected, query]);

  const upsertTag = async (rawValue: string) => {
    const value = rawValue.trim();
    if (!value) return;

    const exists = selectedTags.some((tag) => tag.toLowerCase() === value.toLowerCase());
    if (exists) {
      setQuery('');
      return;
    }

    onChange([...selectedTags, value]);
    await onCreateTag?.(value);
    setQuery('');
  };

  const removeTag = (tagToRemove: string) => {
    onChange(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  const canCreateFromQuery =
    query.trim().length > 0
    && !availableTags.some((tag) => tag.toLowerCase() === query.trim().toLowerCase())
    && !selectedTags.some((tag) => tag.toLowerCase() === query.trim().toLowerCase());

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-900 text-white">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="text-white/80 hover:text-white">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ',') && query.trim()) {
              event.preventDefault();
              void upsertTag(query);
            }
          }}
          className="w-full bg-transparent focus:outline-none text-sm"
          placeholder={placeholder}
        />
      </div>

      {(suggestions.length > 0 || canCreateFromQuery) && (
        <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden bg-white">
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => void upsertTag(tag)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
            >
              {tag}
            </button>
          ))}
          {canCreateFromQuery && (
            <button
              type="button"
              onClick={() => void upsertTag(query)}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Add "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
