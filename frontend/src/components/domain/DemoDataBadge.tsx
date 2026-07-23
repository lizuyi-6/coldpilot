import styles from './DemoDataBadge.module.css';

const LABELS = {
  demo: '演示数据',
  simulated: '仿真结果',
  real: '真实结果',
} as const;

/** 统一标注数据来源：演示 / 仿真 / 真实。 */
export function DemoDataBadge({ kind = 'demo' }: { kind?: keyof typeof LABELS }) {
  return <span className={`${styles.badge} ${styles[kind]}`}>{LABELS[kind]}</span>;
}