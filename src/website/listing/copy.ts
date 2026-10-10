import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import type { ListingSection } from './params'

export const FILTER_LABELS = {
  allSources: msg({ comment: 'Filter option: posts from all sources', message: 'All sources' }),
  allTags: msg({ comment: 'Filter option: no tag filter', message: 'All tags' }),
  allTopics: msg({ comment: 'Filter option: no GitHub topic filter', message: 'All topics' }),
  allTypes: msg({ comment: 'Filter option: resources of every type', message: 'All types' }),
  allVersions: msg({
    comment: 'Filter option: builds based on any Payload version',
    message: 'All versions',
  }),
  newest: msg({ comment: 'Sort option: most recently added first', message: 'Newest' }),
  sort: msg({ comment: 'Label of the sort order select on listings', message: 'Sort by' }),
  source: msg({ comment: 'Filter label: the site a news post comes from', message: 'Source' }),
  stars: msg({ comment: 'Sort option: most GitHub stars first', message: 'Most stars' }),
  tag: msg({ comment: 'Filter label', message: 'Tag' }),
  topic: msg({ comment: 'Filter label: GitHub repository topic', message: 'Topic' }),
  type: msg({ comment: 'Filter label: kind of resource (docs, video, …)', message: 'Type' }),
  updated: msg({
    comment: 'Sort option: most recently updated first',
    message: 'Recently updated',
  }),
  version: msg({
    comment: 'Filter label: the Payload version a build is based on',
    message: 'Payload version',
  }),
}

export const LISTING_COPY: Record<
  ListingSection,
  {
    description: MessageDescriptor
    search: MessageDescriptor
    submit: MessageDescriptor
    title: MessageDescriptor
  }
> = {
  builds: {
    description: msg`Payload builds that bundle unreleased fixes and features on top of an official release.`,
    search: msg({ comment: 'Search field label on the builds listing', message: 'Search builds' }),
    submit: msg({ comment: 'Button on the builds listing', message: 'Submit a build' }),
    title: msg({ comment: 'Page title: listing of custom Payload builds', message: 'Builds' }),
  },
  news: {
    description: msg`Posts from the Payload blog and other sources, plus articles written by the community.`,
    search: msg({ comment: 'Search field label on the news listing', message: 'Search news' }),
    submit: msg({ comment: 'Button on the news listing', message: 'Write a post' }),
    title: msg({ comment: 'Page title: listing of news posts', message: 'News' }),
  },
  plugins: {
    description: msg`Payload plugins found on GitHub and npm, with stars, versions and weekly downloads.`,
    search: msg({
      comment: 'Search field label on the plugins listing',
      message: 'Search plugins',
    }),
    submit: msg({ comment: 'Button on the plugins listing', message: 'Submit a plugin' }),
    title: msg({ comment: 'Page title: listing of Payload plugins', message: 'Plugins' }),
  },
  resources: {
    description: msg`Docs, courses, videos, tools and other resources for learning and building with Payload.`,
    search: msg({
      comment: 'Search field label on the resources listing',
      message: 'Search resources',
    }),
    submit: msg({ comment: 'Button on the resources listing', message: 'Submit a resource' }),
    title: msg({ comment: 'Page title: listing of learning resources', message: 'Resources' }),
  },
}
