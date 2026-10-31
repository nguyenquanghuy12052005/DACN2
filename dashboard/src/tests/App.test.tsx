import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../app/App';
import { describe, expect, it } from 'vitest';

function start(path = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
describe('design preview provenance and boundaries', () => {
  it('switches compact detail tabs by keyboard and keeps events visibly labeled as samples', async () => {
    start();
    const topology = screen.getByRole('tab', { name: 'Sơ đồ' });
    topology.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Lưu lượng' })).toHaveFocus();
    expect(
      screen.getByRole('img', { name: /Biểu đồ mẫu/ }),
    ).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('table')).toBeInTheDocument();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Dấu vân tay' })).toHaveFocus();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('removes sample metrics, chart and events when switching to unavailable Live', async () => {
    start();
    expect(screen.getByText('4.37')).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText('Nguồn dữ liệu'),
      'live',
    );
    expect(screen.queryByText('4.37')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: /Biểu đồ mẫu/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('TRỰC TIẾP · CHƯA KẾT NỐI')).toBeInTheDocument();
  });
  it('does not claim a real registration from the form preview', async () => {
    start('/demo');
    await userEvent.type(
      screen.getByLabelText('Mã người tham gia giả lập'),
      'DEMO001',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Xem trước yêu cầu' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'chưa gửi yêu cầu HTTP',
    );
    expect(
      screen.getByRole('button', { name: /Đăng ký qua Gateway/ }),
    ).toBeDisabled();
    await userEvent.selectOptions(
      screen.getByLabelText('Nguồn dữ liệu'),
      'live',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Đăng ký qua Gateway' }),
    ).toBeDisabled();
  });
  it('keeps load controls locked when selecting a DDoS preset', async () => {
    start('/dashboard/simulation');
    await userEvent.click(
      screen.getByRole('radio', { name: /Mô phỏng DDoS L7/ }),
    );
    expect(
      screen.getByRole('button', { name: 'Bắt đầu kịch bản' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Dừng kịch bản' }),
    ).toBeDisabled();
    expect(screen.getByText('Chưa có bộ điều khiển')).toBeInTheDocument();
  });
  it('shows explicit empty/loading/offline previews without fixture numbers', async () => {
    start();
    for (const state of ['loading', 'empty', 'offline']) {
      await userEvent.selectOptions(
        screen.getByLabelText('Trạng thái mẫu'),
        state,
      );
      expect(screen.queryByText('4.37')).not.toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    }
  });
});
