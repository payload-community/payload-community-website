'use client'

import { PublishButton, useAuth } from '@payloadcms/ui'
import type { PublishButtonClientProps } from 'payload'
import React from 'react'

import { isModerator } from '@/access'

/** Regular users only save drafts (every save is a submission for review). */
export function ModeratedPublishButton(props: PublishButtonClientProps) {
  const { user } = useAuth()
  return isModerator(user) ? <PublishButton {...props} /> : null
}

/** Unpublishing is a moderation action (sidebar and dashboard), so Payload's control is hidden. */
export function ModeratedUnpublishButton() {
  return null
}
