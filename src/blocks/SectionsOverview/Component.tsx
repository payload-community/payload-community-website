import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import type { SectionsOverviewBlock as SectionsOverviewProps } from '@/payload-types'

export const SectionsOverviewBlock: React.FC<SectionsOverviewProps> = ({ heading, sections }) => {
  if (!sections?.length) return null

  return (
    <section className="container" data-testid="sections-overview">
      {heading && <h2 className="mb-6 text-2xl font-semibold">{heading}</h2>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((section) => (
          <li
            className="relative flex flex-col gap-2 rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/30 focus-within:ring-2 focus-within:ring-ring"
            key={section.id ?? section.href}
          >
            <h3 className="text-lg font-semibold">
              <Link
                className="inline-flex items-center gap-1 after:absolute after:inset-0 focus:outline-none"
                href={section.href}
              >
                {section.title}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </h3>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
