'use client'
import { Button } from '@/components/ui/button'
import { useLingui } from '@lingui/react/macro'
import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function CopyButton({ code, label }: { code: string; label?: string }) {
  const { t } = useLingui()
  const [copied, setCopied] = useState(false)

  return (
    <div className="flex justify-end align-middle">
      <Button
        aria-label={label}
        className="flex gap-1"
        onClick={async () => {
          await navigator.clipboard.writeText(code)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        size="sm"
        type="button"
        variant="secondary"
      >
        <span aria-live="polite">
          {copied
            ? t({ comment: 'Copy button state after the code was copied', message: 'Copied!' })
            : t({ comment: 'Button that copies a code snippet to the clipboard', message: 'Copy' })}
        </span>
        {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      </Button>
    </div>
  )
}
