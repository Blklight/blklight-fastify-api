import { render } from '@react-email/render';
import { VerificationEmail } from './verification';
import { WelcomeEmail } from './welcome';
import { PasswordResetEmail } from './password-reset';

export async function renderVerificationEmail(props: {
  username: string;
  verifyUrl: string;
  expiresInHours: number;
}): Promise<string> {
  return render(VerificationEmail(props));
}

export async function renderWelcomeEmail(props: {
  username: string;
  profileUrl: string;
}): Promise<string> {
  return render(WelcomeEmail(props));
}

export async function renderPasswordResetEmail(props: {
  username: string;
  resetUrl: string;
  expiresInMinutes: number;
}): Promise<string> {
  return render(PasswordResetEmail(props));
}
