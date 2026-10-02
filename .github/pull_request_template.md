<!--
Written for a reader who does not read TypeScript: say what happens, not how
the code does it. Title: one plain English sentence, it becomes the commit on
main ("Mines: flags survive a pause").
-->

## What changes for the player

<!-- What someone playing will notice. "Nothing" for tests, docs and CI. -->

## Tested

<!-- What you ran and what you tried by hand. -->

## Try it yourself

<!-- The steps to see the change in a minute, starting from `/arcade`. -->

## Independent review

<!-- What `/code-review` found and what became of it. "Docs only" if no code changed. -->

## Checklist

- [ ] `claude plugin validate .` and `claude plugin test .` pass
- [ ] Every behaviour change has a test
- [ ] Every text the player sees is a key in `hooks/i18n.ts`, in all ten languages
- [ ] No trademarks and no look-alikes of protected games, in names, looks and code
- [ ] If `hooks/`, `sounds/`, `types/` or `.claude-plugin/` changed: the version is raised and `CHANGELOG.md` has its section, written for the player
