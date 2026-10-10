'use client'

import 'vanilla-cookieconsent/dist/cookieconsent.css'

import { useLingui } from '@lingui/react/macro'
import { GoogleAnalytics } from '@next/third-parties/google'
import React, { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import * as CookieConsent from 'vanilla-cookieconsent'

import type { SiteConfig } from './types'

type ConsentContextValue = {
  /** True when GA is configured, i.e. there is something to consent to. */
  analyticsAvailable: boolean
  showPreferences: () => void
}

const ConsentContext = createContext<ConsentContextValue>({
  analyticsAvailable: false,
  showPreferences: () => undefined,
})

export const useConsent = (): ConsentContextValue => use(ConsentContext)

/** Consent Mode v2: the same `gtag` shim as GA's, so the commands queue before the GA script loads. */
function gtag(..._args: unknown[]): void {
  window.dataLayer = window.dataLayer || []
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments)
}

const DENIED = {
  ad_personalization: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  analytics_storage: 'denied',
} as const

let consentDefaultSet = false

const updateAnalyticsConsent = (granted: boolean): void => {
  if (!consentDefaultSet) {
    gtag('consent', 'default', DENIED)
    consentDefaultSet = true
  }
  gtag('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' })
}

export const ConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useLingui()
  const [gaId, setGaId] = useState<string | null>(null)
  const [analyticsGranted, setAnalyticsGranted] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/site-config.json', { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<SiteConfig>) : null))
      .then((config) => setGaId(config?.gaMeasurementId ?? null))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!gaId) return

    const sync = () => {
      const granted = CookieConsent.acceptedCategory('analytics')
      updateAnalyticsConsent(granted)
      setAnalyticsGranted(granted)
    }

    void CookieConsent.run({
      categories: {
        analytics: { autoClear: { cookies: [{ name: /^_ga/ }] } },
        necessary: { enabled: true, readOnly: true },
      },
      guiOptions: {
        consentModal: { equalWeightButtons: true, layout: 'box', position: 'bottom right' },
        preferencesModal: { equalWeightButtons: true, layout: 'box' },
      },
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: {
              acceptAllBtn: t({ comment: 'Cookie banner button', message: 'Accept analytics' }),
              acceptNecessaryBtn: t({ comment: 'Cookie banner button', message: 'Reject' }),
              description: t({
                comment: 'Cookie banner text; the link opens the privacy policy',
                message:
                  'We would like to use Google Analytics to understand how the site is used. It is only loaded if you agree. <a href="/privacy">Privacy policy</a>',
              }),
              showPreferencesBtn: t({
                comment: 'Cookie banner button that opens the detailed cookie settings',
                message: 'Settings',
              }),
              title: t({ comment: 'Cookie banner title', message: 'Cookies and analytics' }),
            },
            preferencesModal: {
              acceptAllBtn: t({ comment: 'Cookie settings dialog button', message: 'Accept all' }),
              acceptNecessaryBtn: t({
                comment: 'Cookie settings dialog button',
                message: 'Reject all',
              }),
              closeIconLabel: t({
                comment: 'Accessible label of the close button of the cookie settings dialog',
                message: 'Close',
              }),
              savePreferencesBtn: t({
                comment: 'Cookie settings dialog button',
                message: 'Save settings',
              }),
              sections: [
                {
                  title: t({ comment: 'Cookie settings section', message: 'Necessary' }),
                  description: t({
                    comment: 'Description of the always-on cookie category',
                    message:
                      'Required for signing in and for remembering your choices, such as the color theme. Always on.',
                  }),
                  linkedCategory: 'necessary',
                },
                {
                  title: t({ comment: 'Cookie settings section', message: 'Analytics' }),
                  description: t({
                    comment: 'Description of the optional analytics cookie category',
                    message:
                      'Google Analytics measures visits and page views. Your IP address is processed by Google.',
                  }),
                  linkedCategory: 'analytics',
                },
              ],
              title: t({ comment: 'Cookie settings dialog title', message: 'Cookie settings' }),
            },
          },
        },
      },
      onChange: sync,
      onConsent: sync,
    })
  }, [gaId, t])

  const showPreferences = useCallback(() => CookieConsent.showPreferences(), [])
  const value = useMemo(
    () => ({ analyticsAvailable: Boolean(gaId), showPreferences }),
    [gaId, showPreferences],
  )

  return (
    <ConsentContext value={value}>
      {children}
      {gaId && analyticsGranted && <GoogleAnalytics gaId={gaId} />}
    </ConsentContext>
  )
}

export const CookieSettingsButton: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useLingui()
  const { analyticsAvailable, showPreferences } = useConsent()
  if (!analyticsAvailable) return null

  return (
    <button className={className} onClick={showPreferences} type="button">
      {t({
        comment: 'Footer link that reopens the cookie settings dialog',
        message: 'Cookie settings',
      })}
    </button>
  )
}
