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

This project is set up as a GitHub user site (`https://<username>.github.io/`).

1. Create a public GitHub repo named `<username>.github.io`.
2. Push `main` to that repo.
3. In the repo settings, enable Pages and set the source to **GitHub Actions**.

The workflow in `.github/workflows/pages.yml` builds on every push to `main` and deploys the static output.
