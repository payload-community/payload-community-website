import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'

import type { Resource } from '@/payload-types'

export const RESOURCE_TYPE_LABELS: Record<Resource['type'], MessageDescriptor> = {
  blog: msg({ comment: 'Resource type', message: 'Blog' }),
  community: msg({
    comment: 'Resource type: a community space such as a forum',
    message: 'Community',
  }),
  course: msg({ comment: 'Resource type', message: 'Course' }),
  docs: msg({ comment: 'Resource type: documentation', message: 'Docs' }),
  other: msg({ comment: 'Resource type', message: 'Other' }),
  tool: msg({ comment: 'Resource type', message: 'Tool' }),
  video: msg({ comment: 'Resource type', message: 'Video' }),
  website: msg({ comment: 'Resource type', message: 'Website' }),
}

export const useResourceTypeLabel = (type: Resource['type']): string => {
  const { t } = useLingui()
  return t(RESOURCE_TYPE_LABELS[type])
}
