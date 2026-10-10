import type { I18nClient } from '@payloadcms/translations'
import React from 'react'

import { isProviderEnabled, safeReturnPath } from '@/auth/oauth'
import type { PlcTranslationKeys, PlcTranslations } from '@/i18n'

import './index.scss'

type Props = {
  i18n: I18nClient<PlcTranslations, PlcTranslationKeys>
  searchParams?: Record<string, string | string[] | undefined>
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const BeforeLogin: React.FC<Props> = ({ i18n, searchParams }) => {
  const providers = (['github', 'google'] as const).filter(isProviderEnabled)
  const error = first(searchParams?.error)
  const returnPath = safeReturnPath(first(searchParams?.redirect))
  const labels = { github: i18n.t('plc:signInWithGitHub'), google: i18n.t('plc:signInWithGoogle') }

  return (
    <div className="plc-before-login">
      {error && (
        <p className="plc-before-login__error" role="alert">
          {error === 'email_unverified' ? i18n.t('plc:oauthEmailUnverified') : i18n.t('plc:oauthError')}
        </p>
      )}
      {providers.map((provider) => (
        <a
          className="btn btn--style-secondary btn--size-large plc-before-login__button"
          href={`/api/users/oauth/${provider}?state=${encodeURIComponent(returnPath)}`}
          key={provider}
        >
          {labels[provider]}
        </a>
      ))}
      {providers.length > 0 && <p>{i18n.t('plc:orSignInWithEmail')}</p>}
    </div>
  )
}

export default BeforeLogin
