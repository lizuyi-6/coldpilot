import { render, screen } from '@testing-library/react';

// F0 冒烟测试：验证 vitest + jsdom + RTL 链路可用。
function Probe() {
  return <p>coldpilot-ok</p>;
}

describe('scaffold smoke', () => {
  it('renders a trivial component', () => {
    render(<Probe />);
    expect(screen.getByText('coldpilot-ok')).toBeInTheDocument();
  });
});