import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
let addToast: ((item: Omit<ToastItem, 'id'>) => void) | null = null;

export function showToast(message: string, type: ToastItem['type'] = 'info') {
  addToast?.({ message, type });
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    addToast = (item) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { ...item, id }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };
    return () => { addToast = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${
            t.type === 'error' ? 'bg-red-600' : t.type === 'success' ? 'bg-green-600' : 'bg-gray-800'
          }`}
        >
          <span>{t.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="p-0.5 hover:bg-white/20 rounded"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
