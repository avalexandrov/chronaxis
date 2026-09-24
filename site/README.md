# Chronaxis site

Live site: https://avalexandrov.github.io/chronaxis/

A small static Vite multipage site. The homepage and four use-case pages use only the public `@chronaxis/browser` API. The Vanilla, React, and Vue live demos are the existing apps in `examples/`; the build copies their output into `site/dist/try/`.

## Build

From the repository root:

```sh
npm ci
npm run build:site
```

The GitHub Pages workflow at `.github/workflows/pages.yml` builds and deploys on pushes to `main`, or when run manually. It publishes the contents of `site/dist/`. No server rendering or rewrite rule is needed; each route has its own `index.html`. For a repository subpath such as GitHub Pages:

```sh
SITE_BASE=/chronaxis/ npm run build:site
```

The base path must begin and end with `/`. The copied framework demos use relative asset paths. Keep the site build in the root CI build; the browser suite starts a preview server on port 4176.

The benchmark page summarizes [`docs/performance-phase-6.md`](../docs/performance-phase-6.md). Package READMEs remain the detailed API documentation.
