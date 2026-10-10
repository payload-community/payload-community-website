declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URI: string
      PAYLOAD_SECRET: string
      NEXT_PUBLIC_SERVER_URL: string
      CRON_SECRET: string
      PREVIEW_SECRET: string
      S3_ENDPOINT: string
      S3_REGION: string
      S3_BUCKET: string
      S3_ACCESS_KEY_ID: string
      S3_SECRET_ACCESS_KEY: string
      S3_FORCE_PATH_STYLE?: string
      S3_PUBLIC_URL: string
      S3_KEY_PREFIX?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
