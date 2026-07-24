import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  children: ReactNode;
  size?: 'sm' | 'md';
}

export function IconButton({ size = 'md', className = '', children, ...rest }: IconButtonProps) {
  return (
    <button type="button" className={`${styles.btn} ${styles[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}