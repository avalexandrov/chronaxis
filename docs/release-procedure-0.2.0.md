# Chronaxis 0.2.0 release procedure

This is a maintainer checklist for an already reviewed release candidate. Do not publish, tag, push, or create the GitHub release until every verification step is complete.

## 1. Verify the repository candidate

```sh
npm ci
npm test
npm run typecheck
npm run build
npm audit
git diff --check
npx playwright install --with-deps chromium firefox webkit
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
npm pack --dry-run -w @chronaxis/core
npm pack --dry-run -w @chronaxis/browser
npm pack --dry-run -w @chronaxis/react
```

Confirm the generated package manifests show coordinated `0.2.0` versions and exact internal dependencies: browser on core `0.2.0`, and React on browser `0.2.0`. Check that the performance report contains the final overlap measurements and that the real-browser result covers the stack pointer regression.

## 2. Verify real packed artifacts externally

Do not use workspace links. Build first, then create actual tarballs and install all three into a temporary consumer in the same install transaction so their exact local dependencies resolve to the packed artifacts.

```sh
npm run build
CONSUMER_DIR="$(mktemp -d /private/tmp/chronaxis-0.2.0-consumer.XXXXXX)"
PACK_DIR="$CONSUMER_DIR/packages"
NPM_CACHE="$CONSUMER_DIR/npm-cache"
mkdir -p "$PACK_DIR"
npm --cache "$NPM_CACHE" pack --pack-destination "$PACK_DIR" -w @chronaxis/core
npm --cache "$NPM_CACHE" pack --pack-destination "$PACK_DIR" -w @chronaxis/browser
npm --cache "$NPM_CACHE" pack --pack-destination "$PACK_DIR" -w @chronaxis/react
cd "$CONSUMER_DIR"
npm init -y
npm --cache "$NPM_CACHE" install --no-save \
  "$PACK_DIR/chronaxis-core-0.2.0.tgz" \
  "$PACK_DIR/chronaxis-browser-0.2.0.tgz" \
  "$PACK_DIR/chronaxis-react-0.2.0.tgz" \
  react@18.3.1 react-dom@18.3.1 @types/react@18 @types/react-dom@18 typescript vite
```

In that consumer, create a small TypeScript/Vite entry that imports `@chronaxis/browser/styles.css`, calls `createTimeline` with `overlap: { mode: 'stack', laneGap: 4 }`, and renders React `Timeline` with the same prop. Include `vite/client` in the consumer TypeScript `types`, compile with `tsc --noEmit`, and build with Vite. This confirms package declarations, the public browser and React option paths, and the CSS export without workspace resolution.

Also run this Node-safe import check from the temporary consumer:

```sh
node --input-type=module --eval "await import('@chronaxis/core'); await import('@chronaxis/browser/runtime'); await import('@chronaxis/react');"
```

Record tarball sizes from `npm pack --json`, then remove the exact temporary directory and its artifacts once the evidence is captured. Do not commit tarballs, consumer files, `node_modules`, browser artifacts, or package-lock files from the temporary consumer.

## 3. Commit and tag after verification

Review the staged diff before committing. The release tag must be new—use `chronaxis-v0.2.0`, never move the historic `v0.1.0`, `react-v0.1.0`, or `chronaxis-v0.1.0` tags.

```sh
git add CHANGELOG.md LICENSE README.md docs package.json package-lock.json packages examples tests .github
git commit -m "Prepare Chronaxis 0.2.0"
git tag -a chronaxis-v0.2.0 -m "Chronaxis 0.2.0"
git push origin main
git push origin chronaxis-v0.2.0
```

## 4. Publish and create the release

Publish in dependency order because internal dependency versions are exact:

```sh
npm publish -w @chronaxis/core --access public
npm publish -w @chronaxis/browser --access public
npm publish -w @chronaxis/react --access public
```

After each publication, confirm npm reports `0.2.0`. Then create the GitHub release from the checked-in release notes:

```sh
gh release create chronaxis-v0.2.0 \
  --title "Chronaxis 0.2.0" \
  --notes-file docs/release-notes-0.2.0.md
```

Finally, repeat the small external consumer smoke test against the public registry artifacts.
