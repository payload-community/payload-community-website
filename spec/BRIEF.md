# Payload CMS community

A portal for the Payload CMS community.

## Technical stack

- Core: Payload CMS v4.x
- Design: Shadcn UI, Tailwind CSS
- I18n: Lingui.js
- Node Package manager: PNPM
- Database: MongoDB
- Tests: Playwright with E2E tests, covering the main functionality.


## Instuctions

- Always try to minimize the amount of custom code by reusing the API and SDK.
- Search and reuse popuar NPM libraries instead of reinventing the wheels by custom code.
- Manage technical specifications in the directory `spec`.
- Manage the developer documentation in the directory `docs`.


## Users and roles

Configure Payload roles:

- Admin: all permissions
- Moderator: manage posts, resources, plugins
- <No role>: crete posts, resources.


## Collections

### Sources

Holds the list of sources to parse to get the posts from remote providers.

### Posts

Grabs and caches the preview of posts in different blogs.

Fields: Title, Date, Source, Author, Summary, Image, URL.

### Resources

A list of resources, related to Payload (websites, blogs, etc).

### Plugins

A list of plugins with the base information, imported from GitHub.


## Website pages

### Frontpage

An overview of the project and the whole idea, and a brief description of the website ections.

### News

An aggregator of the news, related to the Payload CMS.

Displays a blog-style previews of the posts from remote blogs and websites, paginated.

### Resources

Displays a list of documents from the "Resources" collection.

### Plugins

Displays a list of documents from the "Plugins" collection.

### Builds

Displays a list of documents from the "Builds" collection.

### Community

Just a page with a Lexical editor, where fill the article about the Payload community and link to the resources.

### About

An article describing the project.


## Navigation 

Main menu:

- Home
- News
- Resources
- Plugins
- Builds
- Community
- About

## Design

Use as the base the "Website" template from the Payload CMS templates.


## Cron jobs

### Post synchronization 

Parses the news sources (blogs and websites with posts) and imports new items into the local database.

Add these sources to the database:
- https://payloadcms.com/posts/blog (find an API endpoint to get the items, can be REST or GraphQL)

Schedule: every 6 hours

### Plugin synchornization

Parses Github project with the topic `payload-plugin` and imports base information about them to the local database.

Schedule: every day
