import { s3Storage, type S3StorageOptions } from '@payloadcms/storage-s3'

type CollectionOptions = Exclude<S3StorageOptions['collections']['media'], true | undefined>
type GenerateFileURL = NonNullable<CollectionOptions['generateFileURL']>

const keyPrefix = (prefix: string) => [process.env.S3_KEY_PREFIX, prefix].filter(Boolean).join('/')

/**
 * Files are served directly by Garage's public web endpoint (`S3_PUBLIC_URL`),
 * not proxied through Payload.
 */
export const generateFileURL: GenerateFileURL = ({ filename, prefix }) => {
  const path = [prefix, filename]
    .filter(Boolean)
    .flatMap((part) => part!.split('/'))
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')

  return `${process.env.S3_PUBLIC_URL.replace(/\/+$/, '')}/${path}`
}

export const storagePlugin = s3Storage({
  bucket: process.env.S3_BUCKET,
  collections: {
    media: {
      disablePayloadAccessControl: true,
      generateFileURL,
      prefix: keyPrefix('media'),
    },
  },
  config: {
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    region: process.env.S3_REGION,
  },
})
