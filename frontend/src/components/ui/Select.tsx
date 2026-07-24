import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export function Select({ options, value, onChange, ariaLabel, className = '', ...rest }: SelectProps) {
  return (
    <div className={`${styles.wrap} ${className}`}>
      <select
        className={styles.select}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={15} className={styles.chevron} aria-hidden />
    </div>
  );
}