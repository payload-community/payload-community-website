import React from 'react'

/** Structured data; `<` is escaped so the payload cannot close the script tag. */
export const JsonLd: React.FC<{ data: Record<string, unknown> }> = ({ data }) => (
  <script
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    type="application/ld+json"
  />
)
