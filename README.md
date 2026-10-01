# Portfolio Platform

Personal site for Vedant Patel — built with TanStack Start, React, TypeScript, and Tailwind CSS.

## Local development

Needs Node.js 22+ and npm.

```sh
npm i
npm run dev
```

The app runs at [http://127.0.0.1:8080](http://127.0.0.1:8080).

```sh
npm run build    # static production build
npm run preview  # serve the built site locally
```

## GitHub Pages

This project deploys as a GitHub **project site** at
[https://vedantpatel04.github.io/Developer-Portfolio-Vedant/](https://vedantpatel04.github.io/Developer-Portfolio-Vedant/).

1. In the repo settings, enable Pages and set the source to **GitHub Actions**.
2. Push `main`. The workflow in `.github/workflows/pages.yml` builds a static
   bundle with base path `/Developer-Portfolio-Vedant/` and deploys it.

Local `npm run dev` still serves from `/`. The project base path is applied only
in CI (`GITHUB_PAGES=true`).
