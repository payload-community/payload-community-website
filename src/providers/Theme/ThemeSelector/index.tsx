'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useLingui } from '@lingui/react/macro'
import React, { useState } from 'react'

import type { Theme } from './types'

import { useTheme } from '..'
import { themeLocalStorageKey } from './types'

export const ThemeSelector: React.FC = () => {
  const { t } = useLingui()
  const { setTheme } = useTheme()
  const [value, setValue] = useState('')

  const onThemeChange = (themeToSet: Theme & 'auto') => {
    if (themeToSet === 'auto') {
      setTheme(null)
      setValue('auto')
    } else {
      setTheme(themeToSet)
      setValue(themeToSet)
    }
  }

  React.useEffect(() => {
    const preference = window.localStorage.getItem(themeLocalStorageKey)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(preference ?? 'auto')
  }, [])

  return (
    <Select onValueChange={onThemeChange} value={value}>
      <SelectTrigger
        aria-label={t`Select a color theme`}
        className="w-auto bg-transparent gap-2 pl-0 md:pl-3 border-none"
      >
        <SelectValue
          placeholder={t({ comment: 'Placeholder of the color theme selector', message: 'Theme' })}
        />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">
          {t({ comment: 'Color theme option: follow the system setting', message: 'Auto' })}
        </SelectItem>
        <SelectItem value="light">
          {t({ comment: 'Color theme option', message: 'Light' })}
        </SelectItem>
        <SelectItem value="dark">
          {t({ comment: 'Color theme option', message: 'Dark' })}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
