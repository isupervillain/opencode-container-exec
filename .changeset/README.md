# Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) for automated versioning and releases.

## For contributors

When your change affects package behavior, add a changeset file:

```bash
npm run changeset
```

Choose the bump type (`patch` / `minor` / `major`) and write a short release note.

## Release flow

- Pushes to `main` run `.github/workflows/release.yml`.
- If unreleased changesets exist, the workflow opens/updates a release PR.
- Merging that PR bumps versions, updates changelog, creates tags, and publishes to npm via GitHub OIDC trusted publishing.
