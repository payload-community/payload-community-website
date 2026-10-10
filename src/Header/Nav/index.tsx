'use client'

import { useLingui } from '@lingui/react/macro'
import { Menu } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Header as HeaderType } from '@/payload-types'
import { cn } from '@/utilities/ui'

type NavLink = { href: string; label: string; newTab: boolean }

const toNavLinks = (data: HeaderType): NavLink[] =>
  (data?.navItems ?? []).flatMap(({ link }) => {
    const href =
      link.type === 'reference' && typeof link.reference?.value === 'object'
        ? link.reference.value.slug === 'home'
          ? '/'
          : `/${link.reference.value.slug}`
        : link.url
    return href ? [{ href, label: link.label, newTab: Boolean(link.newTab) }] : []
  })

const isActive = (pathname: string, href: string): boolean =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const { t } = useLingui()
  const pathname = usePathname()
  const links = toNavLinks(data)
  const newTabProps = (link: NavLink) =>
    link.newTab ? { rel: 'noopener noreferrer', target: '_blank' } : {}

  return (
    <>
      <nav
        aria-label={t({ comment: 'Accessible name of the main navigation', message: 'Main' })}
        className="hidden items-center gap-5 lg:flex"
      >
        {links.map((link) => {
          const active = isActive(pathname, link.href)
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                'text-sm font-medium transition-colors hover:text-foreground',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
              href={link.href}
              key={link.href}
              {...newTabProps(link)}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={t({
              comment: 'Accessible name of the menu button shown on small screens',
              message: 'Open navigation menu',
            })}
            className="lg:hidden"
            size="icon"
            variant="ghost"
          >
            <Menu aria-hidden className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {links.map((link) => (
            <DropdownMenuItem asChild key={link.href}>
              <Link
                aria-current={isActive(pathname, link.href) ? 'page' : undefined}
                href={link.href}
                {...newTabProps(link)}
              >
                {link.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
