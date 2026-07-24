import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Input.module.css';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  prefix?: ReactNode;
}

export function Input({ prefix, className = '', ...rest }: InputProps) {
  if (prefix) {
    return (
      <div className={`${styles.wrap} ${className}`}>
        <span className={styles.prefix}>{prefix}</span>
        <input className={`${styles.input} ${styles.inputWithPrefix}`} {...rest} />
      </div>
    );
  }
  return <input className={`${styles.input} ${className}`} {...rest} />;
}