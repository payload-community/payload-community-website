import { msg } from '@lingui/core/macro'

export const FACT_LABELS = {
  added: msg({
    comment: 'Detail page fact: when the entry was added to the portal',
    message: 'Added',
  }),
  basePayloadVersion: msg({
    comment: 'Build page fact: the Payload release the build starts from',
    message: 'Based on Payload',
  }),
  forks: msg({ comment: 'Plugin page fact: GitHub forks', message: 'Forks' }),
  githubCreated: msg({
    comment: 'Plugin page fact: when the GitHub repository was created',
    message: 'Created on GitHub',
  }),
  homepage: msg({ comment: 'Detail page fact: project website link', message: 'Homepage' }),
  includedChanges: msg({
    comment: 'Build page section heading: pull requests or patches included in the build',
    message: 'Included changes',
  }),
  lastPublished: msg({
    comment: 'Plugin page fact: when the latest npm version was published',
    message: 'Last published',
  }),
  lastPushed: msg({
    comment: 'Plugin page fact: last code push on GitHub',
    message: 'Last code update',
  }),
  latestVersion: msg({
    comment: 'Plugin page fact: latest npm version',
    message: 'Latest version',
  }),
  license: msg({ comment: 'Plugin page fact: software license, e.g. MIT', message: 'License' }),
  npmPackage: msg({ comment: 'Detail page fact: npm package name', message: 'npm package' }),
  repository: msg({
    comment: 'Plugin page section heading: GitHub repository facts',
    message: 'Repository',
  }),
  stars: msg({ comment: 'Plugin page fact: GitHub stars', message: 'GitHub stars' }),
  updated: msg({
    comment: 'Detail page fact: when the entry was last changed',
    message: 'Last updated',
  }),
  weeklyDownloads: msg({
    comment: 'Plugin page fact: npm downloads in the last week',
    message: 'Weekly downloads',
  }),
}
