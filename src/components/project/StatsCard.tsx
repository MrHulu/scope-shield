interface StatsCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  color?: string;
}

export function StatsCard({ label, value, suffix, color }: StatsCardProps) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 flex-1 min-w-0">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color ?? 'text-gray-900'}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-gray-500 ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}
