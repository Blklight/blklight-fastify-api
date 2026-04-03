import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Preview,
  Link,
} from '@react-email/components';
import * as React from 'react';

interface VerificationEmailProps {
  username: string;
  verifyUrl: string;
  expiresInHours: number;
}

export function VerificationEmail({
  username,
  verifyUrl,
  expiresInHours,
}: VerificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Confirm your email to get started on blklight</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>blklight</Text>
          </Section>

          <Section style={contentSection}>
            <Text style={greeting}>Hi {username},</Text>
            <Text style={text}>
              Thanks for signing up! Please verify your email address to activate your account.
            </Text>

            <Button style={button} href={verifyUrl}>
              Verify Email
            </Button>

            <Text style={text}>
              Or copy this link:{' '}
              <Link href={verifyUrl} style={link}>
                {verifyUrl}
              </Link>
            </Text>

            <Hr style={hr} />

            <Text style={expiry}>
              This link expires in {expiresInHours} hours.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You received this email because you have an account on blklight.
            </Text>
            <Text style={footerText}>
              If you did not perform this action, please ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container: React.CSSProperties = {
  margin: '0 auto',
  padding: '20px 0 48px',
  width: '465px',
};

const logoSection: React.CSSProperties = {
  textAlign: 'center' as const,
  padding: '32px 0',
};

const logoText: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#000000',
  margin: 0,
};

const contentSection: React.CSSProperties = {
  padding: '0 24px',
};

const greeting: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#374151',
  margin: '0 0 16px',
};

const text: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#374151',
  margin: '0 0 16px',
};

const button: React.CSSProperties = {
  backgroundColor: '#6366f1',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '24px',
  padding: '12px 24px',
  textAlign: 'center' as const,
  textDecoration: 'none',
  margin: '16px 0',
};

const link: React.CSSProperties = {
  color: '#6366f1',
  textDecoration: 'underline',
  fontSize: '14px',
};

const hr: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #e5e7eb',
  margin: '24px 0',
};

const expiry: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  margin: 0,
};

const footer: React.CSSProperties = {
  padding: '0 24px',
};

const footerText: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 0 8px',
  textAlign: 'center' as const,
};
