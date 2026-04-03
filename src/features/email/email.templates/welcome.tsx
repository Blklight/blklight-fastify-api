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
} from '@react-email/components';
import * as React from 'react';

interface WelcomeEmailProps {
  username: string;
  profileUrl: string;
}

export function WelcomeEmail({ username, profileUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your account is verified — welcome to blklight</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={logoSection}>
            <Text style={logoText}>blklight</Text>
          </Section>

          <Section style={contentSection}>
            <Text style={greeting}>Welcome, {username}!</Text>
            <Text style={text}>
              Your email has been verified. You're all set to start writing, publishing, and exploring.
            </Text>

            <Section style={featuresSection}>
              <Text style={featuresTitle}>Here's what you can do:</Text>
              <Text style={featureItem}>
                <Text style={featureBullet}>•</Text> Write and publish articles, tutorials, and more
              </Text>
              <Text style={featureItem}>
                <Text style={featureBullet}>•</Text> Build your personal library with highlights and journals
              </Text>
              <Text style={featureItem}>
                <Text style={featureBullet}>•</Text> Follow authors and discover great content
              </Text>
            </Section>

            <Button style={button} href={profileUrl}>
              Go to your profile
            </Button>
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

const featuresSection: React.CSSProperties = {
  padding: '16px 0',
};

const featuresTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#374151',
  margin: '0 0 12px',
};

const featureItem: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#374151',
  margin: '0 0 8px',
  paddingLeft: '8px',
};

const featureBullet: React.CSSProperties = {
  color: '#6366f1',
  fontWeight: '600',
  marginRight: '8px',
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

const footer: React.CSSProperties = {
  padding: '0 24px',
};

const footerText: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  margin: '0 0 8px',
  textAlign: 'center' as const,
};
