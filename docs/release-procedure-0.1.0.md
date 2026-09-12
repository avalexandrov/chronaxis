# Chronaxis 0.1.0 release procedure

This is the recommended maintainer procedure after reviewing the release-candidate diff. None of these release commands were executed during preparation.

## 1. Verify the candidate

```sh
npm ci
npm test
npm run typecheck
npm run build
npm audit
npm run test:browser
git diff --check
npm pack --dry-run -w @chronaxis/core
npm pack --dry-run -w @chronaxis/browser
npm pack --dry-run -w @chronaxis/react
```

Confirm npm authentication and ownership for the `@chronaxis` scope separately before changing Git state:

```sh
npm whoami
npm access list packages
```

## 2. Commit and tag

```sh
git add CHANGELOG.md LICENSE README.md docs package.json package-lock.json packages examples
git commit -m "Prepare Chronaxis 0.1.0"
git tag -a chronaxis-v0.1.0 -m "Chronaxis 0.1.0"
git push origin main
git push origin chronaxis-v0.1.0
```

The repository already has a published `v0.1.0` tag for an earlier core-engine milestone, so it must not be moved or reused. `chronaxis-v0.1.0` identifies the coordinated package release without rewriting history. Review the staged file list before committing. Do not include build output, tarballs, dependency folders, browser artifacts, or the temporary consumer project.

## 3. Publish in dependency order

Scoped packages are private by default on npm unless public access is specified. Publish in this exact order so every exact internal dependency already exists when its dependent package is published:

```sh
npm publish -w @chronaxis/core --access public
npm publish -w @chronaxis/browser --access public
npm publish -w @chronaxis/react --access public
```

After each command, confirm that npm reports version `0.1.0` before continuing. npm publication is permanent; use npm account 2FA/provenance policy appropriate to the maintainer account.

## 4. Create the GitHub release

```sh
gh release create chronaxis-v0.1.0 \
  --title "Chronaxis 0.1.0" \
  --notes-file docs/release-notes-0.1.0.md
```

Finally, install the three packages from the public registry in a clean directory and repeat the small Node and Vite consumer smoke checks.
