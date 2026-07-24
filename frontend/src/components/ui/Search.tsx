import { Search as SearchIcon } from 'lucide-react';
import { Input } from './Input';

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

export function Search({ value, onChange, placeholder = '搜索', ariaLabel = '搜索', className }: SearchProps) {
  return (
    <Input
      prefix={<SearchIcon size={15} strokeWidth={2} />}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      type="search"
      className={className}
    />
  );
}