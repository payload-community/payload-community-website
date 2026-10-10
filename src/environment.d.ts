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
      GITHUB_TOKEN?: string
      GITHUB_CLIENT_ID?: string
      GITHUB_CLIENT_SECRET?: string
      GOOGLE_CLIENT_ID?: string
      GOOGLE_CLIENT_SECRET?: string
      ADMIN_GITHUB_LOGINS?: string
      ADMIN_EMAILS?: string
      SMTP_HOST?: string
      SMTP_PORT?: string
      SMTP_SECURE?: string
      SMTP_USER?: string
      SMTP_PASS?: string
      EMAIL_FROM_ADDRESS?: string
      EMAIL_FROM_NAME?: string
      JOBS_AUTORUN?: string
      LOG_LEVEL?: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
