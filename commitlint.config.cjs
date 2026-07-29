// Conventional Commits — drives the version semantic-release computes on merge to main.
// feat -> minor, fix -> patch, `feat!`/`BREAKING CHANGE:` -> major.
module.exports = { extends: ["@commitlint/config-conventional"] };
