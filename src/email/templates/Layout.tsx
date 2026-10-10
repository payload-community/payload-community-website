import { Body, Button, Container, Head, Hr, Html, Link, Preview, Section, Text } from 'react-email'
import React from 'react'

import { messages } from '../messages'

export const Layout: React.FC<{ children: React.ReactNode; preview: string }> = ({
  children,
  preview,
}) => (
  <Html lang="en">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: '#f4f4f5', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      <Container style={{ backgroundColor: '#ffffff', margin: '24px auto', padding: '32px' }}>
        <Text style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{messages.siteName}</Text>
        <Section>{children}</Section>
        <Hr />
        <Text style={{ color: '#71717a', fontSize: '12px' }}>{messages.footer}</Text>
      </Container>
    </Body>
  </Html>
)

export type EmailDetail = { label: string; value: string }

export const ActionEmail: React.FC<{
  body: string
  button: string
  details?: EmailDetail[]
  heading: string
  note?: string
  preview: string
  secondaryLink?: { label: string; url: string }
  url: string
}> = ({ body, button, details, heading, note, preview, secondaryLink, url }) => (
  <Layout preview={preview}>
    <Text style={{ fontSize: '20px', fontWeight: 700 }}>{heading}</Text>
    <Text style={{ fontSize: '14px', lineHeight: '22px' }}>{body}</Text>
    {details?.map(({ label, value }) => (
      <Text key={label} style={{ fontSize: '14px', lineHeight: '20px', margin: '4px 0' }}>
        <strong>{label}:</strong> {value}
      </Text>
    ))}
    {secondaryLink && (
      <Text style={{ fontSize: '14px' }}>
        <Link href={secondaryLink.url}>{secondaryLink.label}</Link>
      </Text>
    )}
    <Section style={{ margin: '24px 0' }}>
      <Button
        href={url}
        style={{
          backgroundColor: '#000000',
          borderRadius: '4px',
          color: '#ffffff',
          fontSize: '14px',
          padding: '12px 20px',
        }}
      >
        {button}
      </Button>
    </Section>
    <Text style={{ color: '#52525b', fontSize: '12px', wordBreak: 'break-all' }}>{url}</Text>
    {note && <Text style={{ color: '#52525b', fontSize: '12px' }}>{note}</Text>}
  </Layout>
)
