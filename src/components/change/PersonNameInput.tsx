import { useState, useEffect, useRef } from 'react';
import type { PersonNameCache } from '../../types';
import { getPersonNames } from '../../db/personNameRepo';

interface PersonNameInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function PersonNameInput({ value, onChange }: PersonNameInputProps) {
  const [suggestions, setSuggestions] = useState<PersonNameCache[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPersonNames().then(setSuggestions);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSugg(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = suggestions.filter(
    (s) => s.name.includes(value) && s.name !== value,
  );

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSugg(true)}
        placeholder="人名（可选）"
        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
      />
      {showSugg && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 py-1 z-10">
          {filtered.slice(0, 5).map((s) => (
            <button
              key={s.id}
              onClick={() => { onChange(s.name); setShowSugg(false); }}
              className="w-full text-left text-sm px-3 py-1.5 hover:bg-gray-50 text-gray-700"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
