'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { resetPasswordAction } from './actions';

/**
 * reset-password.tsx — copy to app/reset-password/page.tsx.
 * The user arrives here with an active recovery session (came from
 * forgot-password → email → route.ts → exchangeCodeForSession).
 */

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await resetPasswordAction({ newPassword: password });
    setIsSubmitting(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    router.push('/login?reset=success');
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Nueva contraseña</h1>

      <label htmlFor="password">Nueva contraseña</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={8}
      />

      <label htmlFor="confirmPassword">Confirmar contraseña</label>
      <input
        id="confirmPassword"
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        required
        minLength={8}
      />

      {error && <p role="alert">{error}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
