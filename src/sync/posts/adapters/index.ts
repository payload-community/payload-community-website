import type { Source } from '@/payload-types'

import type { PostSourceAdapter } from '../types'
import { payloadRestAdapter } from './payloadRest'

export const postSourceAdapters: Record<Source['type'], PostSourceAdapter> = {
  'payload-rest': payloadRestAdapter,
}
