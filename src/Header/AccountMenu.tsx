'use client'

import { Trans, useLingui } from '@lingui/react/macro'
import { UserRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { User } from '@/payload-types'

type MeUser = Pick<User, 'avatarUrl' | 'email' | 'id' | 'name' | 'roles'>

/**
 * Loaded in the browser so that pages stay static; `undefined` while loading, `null` when signed out.
 */
const useCurrentUser = (): [MeUser | null | undefined, () => void] => {
  const pathname = usePathname()
  const [user, setUser] = useState<MeUser | null | undefined>(undefined)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/users/me', { credentials: 'include', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data: { user?: MeUser | null }) => setUser(data.user ?? null))
      .catch(() => {
        if (!controller.signal.aborted) setUser(null)
      })
    return () => controller.abort()
  }, [pathname, version])

  return [user, () => setVersion((v) => v + 1)]
}

export const AccountMenu: React.FC = () => {
  const { t } = useLingui()
  const router = useRouter()
  const [user, reload] = useCurrentUser()

  if (user === undefined) return <div aria-hidden className="h-9 w-20" />

  if (!user) {
    return (
      <Button asChild size="sm">
        <Link href="/sign-in">
          <Trans comment="Header button that opens the sign-in page">Sign in</Trans>
        </Link>
      </Button>
    )
  }

  const isModerator = user.roles?.some((role) => role === 'admin' || role === 'moderator')
  const displayName = user.name || user.email

  const signOut = async () => {
    await fetch('/api/users/logout', { credentials: 'include', method: 'POST' }).catch(() => null)
    reload()
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t({
            comment: 'Accessible name of the account menu button in the header',
            message: `Account menu for ${displayName}`,
          })}
          className="gap-2 px-2"
          size="sm"
          variant="ghost"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="size-7 rounded-full"
              height={28}
              referrerPolicy="no-referrer"
              src={user.avatarUrl}
              width={28}
            />
          ) : (
            <UserRound aria-hidden className="size-5" />
          )}
          <span className="hidden max-w-40 truncate lg:inline">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <Trans comment="Account menu item: the user's account page on the website">
              My account
            </Trans>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin">
            <Trans comment="Account menu item: opens the admin panel where users manage their submitted entries">
              My entries
            </Trans>
          </Link>
        </DropdownMenuItem>
        {isModerator && (
          <DropdownMenuItem asChild>
            <Link href="/admin/moderation">
              <Trans comment="Account menu item for moderators: the queue of entries waiting for review">
                Moderation queue
              </Trans>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <Trans comment="Account menu item that signs the user out">Sign out</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
