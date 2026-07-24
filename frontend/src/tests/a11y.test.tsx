import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from '@/components/ui/Dialog';
import { Drawer } from '@/components/ui/Drawer';

describe('无障碍交互', () => {
  it('ESC 关闭 Dialog', async () => {
    let closed = false;
    const onClose = () => {
      closed = true;
    };
    render(
      <Dialog open title="确认操作" onClose={onClose}>
        <p>内容</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(closed).toBe(true);
  });

  it('ESC 关闭 Drawer', async () => {
    let closed = false;
    render(
      <Drawer open title="详情" onClose={() => (closed = true)}>
        <p>内容</p>
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(closed).toBe(true);
  });

  it('Dialog 打开时渲染遮罩与标题', () => {
    render(
      <Dialog open title="批准方案" onClose={() => {}}>
        <p>确认批准？</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: '批准方案' })).toBeInTheDocument();
  });
});