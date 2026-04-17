import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Preview,
} from '@react-email/components';
import * as React from 'react';

interface MemoryDigestEmailProps {
  username: string;
  connections: Array<{
    sourceType: string;
    sourceId: string;
    title: string | null;
    snippet: string;
    similarity: number;
  }>;
}

export function MemoryDigestEmail({ username, connections }: MemoryDigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your blklight connections this week</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>blklight</Text>
          </Section>

          <Section style={contentSection}>
            <Text style={greeting}>Hi {username},</Text>
            <Text style={text}>
              Here are your top connections from this week:
            </Text>

            {connections.map((conn, index) => (
              <Section key={conn.sourceId} style={connectionItem}>
                <Text style={connectionTitle}>
                  {index + 1}. {conn.title || 'Untitled'}
                </Text>
                <Text style={connectionSnippet}>
                  {conn.snippet.slice(0, 100)}...
                </Text>
                <Text style={similarity}>
                  Similarity: {Math.round(conn.similarity * 100)}%
                </Text>
              </Section>
            ))}

            <Text style={text}>
              Keep exploring and connecting your ideas on blklight.
            </Text>
          </Section>

          <Section style={footer}>
            <Text style={footerText}>
              You received this email because you have an account on blklight.
            </Text>
            <Text style={footerText}>
              If you did not request this, please ignore this email.
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

const header: React.CSSProperties = {
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

const connectionItem: React.CSSProperties = {
  padding: '16px',
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  marginBottom: '12px',
};

const connectionTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#374151',
  margin: '0 0 8px',
};

const connectionSnippet: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '0 0 8px',
};

const similarity: React.CSSProperties = {
  fontSize: '12px',
  color: '#6366f1',
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