import { danger, fail, markdown, schedule, warn } from "danger"

import * as path from "path"

// Get some commonly used elements out of the DSL
const pr = danger.github.pr

const modified = danger.git.modified_files
const bodyAndTitle = (pr.body + pr.title).toLowerCase()

// Custom modifiers for people submitting PRs to be able to say "skip this"
const trivialPR = bodyAndTitle.includes("trivial")

const acceptedNoTests = bodyAndTitle.includes("skip new tests")
const typescriptOnly = (file: string) => file.includes(".ts")
const filesOnly = (file: string) => file.endsWith("/")

// Custom subsets of known files
const modifiedAppFiles = modified.filter(p => p.includes("lib/")).filter(p => filesOnly(p) && typescriptOnly(p))

// Modified or Created can be treated the same a lot of the time
const touchedFiles = modified.concat(danger.git.created_files).filter(p => filesOnly(p))

const touchedAppOnlyFiles = touchedFiles.filter(
    p => p.includes("src/lib/") && !p.includes("__tests__") && typescriptOnly(p)
)

// Rules

// When there are app-changes and it us not a PR marked as trivial, expect
// there to be CHANGELOG changes.

const changelogChanges = modified.find(f => f === "CHANGELOG.md")
if (modifiedAppFiles.length > 0 && !trivialPR && !changelogChanges) {
    fail("No CHANGELOG added.")
}

// No PR is too small to warrant a paragraph or two of summary
if (pr.body.length === 0) {
    fail("Please add a description to your PR.")
}
// Always ensure we assign someone to a PR, if its a
if (pr.assignee === null) {
    const method = pr.title.includes("WIP") ? warn : fail
    method("Please assign someone to merge this PR, and optionally include people who should review.")
}
// Check that every file touched has a corresponding test file
const correspondingTestsForAppFiles = touchedAppOnlyFiles.map(f => {
    const newPath = path.dirname(f)
    const name = path.basename(f).replace(".ts", "-tests.ts")
    return `${newPath}/__tests__/${name}`
})

// New app files should get new test files
// Allow warning instead of failing if you say "Skip New Tests" inside the body, make it explicit.

const testFilesThatShouldExist = correspondingTestsForAppFiles
    .filter(f => !f.includes("index-tests.tsx")) // skip indexes
.filter(f => !f.includes("__stories__")) // skip stories
.filter(f => !f.includes("app_registry")) // skip registry, kinda untestable
.filter(f => !f.includes("routes")) // skip routes, kinda untestable
.filter(f => !f.includes("native_modules")) // skip native_modules

if (testFilesThatShouldExist.length > 0) {
    const callout = acceptedNoTests ? warn : fail
    const output = `Missing Test Files:` + testFilesThatShouldExist.map(f => `- \`${f}\``).join("\n")

    callout(output)
}

// Ensure that a label has been set
if (danger.github.issue.labels.length === 0) {
    warn("This PR does not have any labels.")
}
