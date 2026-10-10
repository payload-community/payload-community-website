import { notFound, redirect } from 'next/navigation'

import { isModeratedCollection } from '@/moderation/config'
import { getCurrentUser } from '@/website/auth/session'

type Args = { params: Promise<{ collection: string }> }

/** `/submit/{posts,resources,plugins,builds}` → the admin create view (sign in first). */
export default async function SubmitPage({ params }: Args) {
  const { collection } = await params
  if (!isModeratedCollection(collection)) notFound()
  if (!(await getCurrentUser()))
    redirect(`/sign-in?next=${encodeURIComponent(`/submit/${collection}`)}`)
  redirect(`/admin/collections/${collection}/create`)
}
