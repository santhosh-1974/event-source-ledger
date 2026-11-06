import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from '../features/auth/RegisterPage';

const { registerUser } = vi.hoisted(() => ({
  registerUser: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ register: registerUser }),
}));

describe('RegisterPage validation', () => {
  beforeEach(() => {
    registerUser.mockReset();
  });

  it('displays field errors instead of throwing on invalid submission', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => {
      expect(screen.getByText('Full name must be at least 3 characters')).toBeInTheDocument();
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
      expect(screen.getByText('Phone number must contain exactly 10 digits')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 12 characters')).toBeInTheDocument();
    });
    expect(registerUser).not.toHaveBeenCalled();
  });
});
