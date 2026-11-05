#!/bin/sh
# Lifted from yggi/cells tools/docs-only.sh (this pull request's sibling), its list of markdown that is code left out:
# none of webmidi's markdown is compiled or read by a test beyond the docs' own.
# Whether a branch changes prose alone, so that the docs check (`npm run verify:docs`: Prettier, the docs' own tests, the
# conflict markers, the boot set's ceiling) stands in for `npm run verify`. Read by the pre-push hook (.githooks/pre-push)
# and by CI (.github/workflows/ci.yml), so the two agree.
#
#   sh tools/docs-only.sh [base]   # prints `docs` or `code`; base: origin/main
#
# `docs` when every file that differs from the base (`<base>...HEAD`, from the merge base) is markdown; `code` otherwise,
# and whenever the diff can't be read or is empty: the fail-safe is the whole of verify.
base=${1:-origin/main}
changed=$(git diff --name-only "$base...HEAD" 2>/dev/null) || {
  echo code
  exit 0
}
if [ -z "$changed" ] || printf '%s\n' "$changed" | grep -qv '\.md$'; then
  echo code
else
  echo docs
fi
