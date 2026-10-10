import { revalidatePath, revalidateTag } from 'next/cache'
import type { Payload } from 'payload'

/**
 * On-demand revalidation only works inside a Next.js request; the CLI (seeds, jobs worker) has no
 * Next.js cache, so pages there catch up through their time-based `revalidate`.
 */
export const safeRevalidate = (
  payload: Payload,
  { paths = [], tags = [] }: { paths?: string[]; tags?: string[] },
): void => {
  try {
    paths.forEach((path) => revalidatePath(path))
    tags.forEach((tag) => revalidateTag(tag, 'max'))
  } catch (error) {
    payload.logger.debug({ err: error, msg: 'Skipped revalidation outside Next.js', paths, tags })
  }
}
