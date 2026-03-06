# Pull Request

## Description
<!-- Brief summary of changes -->

## Related Issue
Closes #

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Testing improvements

## Testing
- [ ] Unit tests pass (`npm run test` in client/server)
- [ ] E2E tests pass (Cypress)
- [ ] Linting passes (`npm run lint`)
- [ ] Manual testing completed
- [ ] New tests added for new functionality

## Design Decisions
<!-- Link to devLog entry if applicable (e.g., devLog/decisions/001-feature-name.md) -->
<!-- For significant architectural changes, create a devLog entry before submitting PR -->

## Checklist
- [ ] Code follows the project's style guidelines
- [ ] Self-review of code completed
- [ ] Comments added for complex logic
- [ ] Documentation updated (if applicable)
- [ ] No new warnings introduced
- [ ] Empirica versions match across client/server/Dockerfile (if dependencies changed)

---

**Note for Agents**: When creating a PR programmatically, ensure:
1. All checkboxes are accurately marked based on actual testing performed
2. Related issue number is correctly linked
3. If the change involves significant architectural decisions, create a devLog entry in `devLog/decisions/` and link it above
4. Summary is clear and describes both *what* changed and *why*
5. Use conventional commit format in the PR title (e.g., `feat(call): add feature`, `fix(server): resolve bug`)
