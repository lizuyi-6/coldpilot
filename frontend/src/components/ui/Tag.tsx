import type { ReactNode } from 'react';
import styles from './Tag.module.css';

export type TagTone = 'neutral' | 'accent' | 'info' | 'warning' | 'danger' | 'success';

interface TagProps {
  tone?: TagTone;
  children: ReactNode;
}

export function Tag({ tone = 'neutral', children }: TagProps) {
  return <span className={`${styles.tag} ${styles[tone]}`}>{children}</span>;
}