import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SendHorizontal } from 'lucide-react';
import type { UseWorkbench } from '@/state/useWorkbench';
import styles from './diagnosis.module.css';

/** 追问输入：仅用于发起任务 / 补充条件 / 追问，非聊天窗口。 */
export function TaskComposer({ wb }: { wb: UseWorkbench }) {
  const [value, setValue] = useState('');
  const canDiagnose = wb.canTransition({ type: 'START_DIAGNOSIS', eventId: wb.selectedEventId ?? '', taskId: 'x' });

  const submit = () => {
    if (!value.trim()) return;
    setValue('');
    if (canDiagnose) void wb.startDiagnosis();
  };

  return (
    <div className={styles.composer}>
      <input
        className={styles.composerInput}
        placeholder="追加提问，例如：如果将目标温度降低 1℃ 会怎样"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        aria-label="追问输入"
      />
      <Button variant="primary" onClick={submit} disabled={!value.trim()}>
        <SendHorizontal size={15} aria-hidden /> 发送
      </Button>
    </div>
  );
}