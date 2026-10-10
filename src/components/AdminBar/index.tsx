'use client'

import type { PayloadAdminBarProps, PayloadMeUser } from '@payloadcms/admin-bar'
import type { MessageDescriptor } from '@lingui/core'

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { cn } from '@/utilities/ui'
import { useSelectedLayoutSegments } from 'next/navigation'
import { PayloadAdminBar } from '@payloadcms/admin-bar'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

import './index.scss'

import { getClientSideURL } from '@/utilities/getURL'

const baseClass = 'admin-bar'

/** First URL segment → collection; anything else is a page. */
const SEGMENT_COLLECTIONS: Record<string, string> = {
  builds: 'builds',
  news: 'posts',
  plugins: 'plugins',
  resources: 'resources',
}

const COLLECTION_LABELS: Record<string, { plural: MessageDescriptor; singular: MessageDescriptor }> =
  {
    builds: {
      plural: msg({ comment: 'Admin bar: collection name', message: 'Builds' }),
      singular: msg({ comment: 'Admin bar: used in "New build" / "Edit build"', message: 'build' }),
    },
    pages: {
      plural: msg({ comment: 'Admin bar: collection name', message: 'Pages' }),
      singular: msg({ comment: 'Admin bar: used in "New page" / "Edit page"', message: 'page' }),
    },
    plugins: {
      plural: msg({ comment: 'Admin bar: collection name', message: 'Plugins' }),
      singular: msg({
        comment: 'Admin bar: used in "New plugin" / "Edit plugin"',
        message: 'plugin',
      }),
    },
    posts: {
      plural: msg({ comment: 'Admin bar: collection name of news posts', message: 'Posts' }),
      singular: msg({ comment: 'Admin bar: used in "New post" / "Edit post"', message: 'post' }),
    },
    resources: {
      plural: msg({ comment: 'Admin bar: collection name', message: 'Resources' }),
      singular: msg({
        comment: 'Admin bar: used in "New resource" / "Edit resource"',
        message: 'resource',
      }),
    },
  }

const isEditor = (user: PayloadMeUser): boolean => {
  const roles = (user as { roles?: string[] | null } | null | undefined)?.roles
  return Boolean(roles?.some((role) => role === 'admin' || role === 'moderator'))
}

/** Shown to moderators and admins only; regular users have the account menu in the header. */
export const AdminBar: React.FC<{
  adminBarProps?: PayloadAdminBarProps
}> = (props) => {
  const { adminBarProps } = props || {}
  const { t } = useLingui()
  const segments = useSelectedLayoutSegments()
  const [show, setShow] = useState(false)
  const collection =
    segments.map((segment) => SEGMENT_COLLECTIONS[segment]).find(Boolean) ?? 'pages'
  const labels = COLLECTION_LABELS[collection]
  const router = useRouter()

  const onAuthChange = React.useCallback((user: PayloadMeUser) => {
    setShow(isEditor(user))
  }, [])

  return (
    <div
      className={cn(baseClass, 'py-2 bg-black text-white', {
        block: show,
        hidden: !show,
      })}
    >
      <div className="container">
        <PayloadAdminBar
          {...adminBarProps}
          className="py-2 text-white"
          classNames={{
            controls: 'font-medium text-white',
            logo: 'text-white',
            user: 'text-white',
          }}
          cmsURL={getClientSideURL()}
          collectionSlug={collection}
          collectionLabels={{ plural: t(labels.plural), singular: t(labels.singular) }}
          logo={
            <span>
              {t({ comment: 'Admin bar link to the admin panel dashboard', message: 'Dashboard' })}
            </span>
          }
          onAuthChange={onAuthChange}
          onPreviewExit={() => {
            fetch('/next/exit-preview').then(() => {
              router.push('/')
              router.refresh()
            })
          }}
          style={{
            backgroundColor: 'transparent',
            padding: 0,
            position: 'relative',
            zIndex: 'unset',
          }}
        />
      </div>
    </div>
  )
}
