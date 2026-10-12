import type { ServerProps } from 'payload'
import React from 'react'

import { isAdmin } from '@/access'

import { SyncNowButton } from './SyncNowButton'

/** Sources list: "Sync now" for all enabled post sources (admins only). */
export function SyncPostsNow({ user }: ServerProps) {
  return isAdmin(user) ? <SyncNowButton task="posts" /> : null
}

/** Plugins list: "Sync now" for the GitHub/npm plugin sync (admins only). */
export function SyncPluginsNow({ user }: ServerProps) {
  return isAdmin(user) ? <SyncNowButton task="plugins" /> : null
}
