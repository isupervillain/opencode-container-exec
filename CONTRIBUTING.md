# Contributing to opencode-container-exec

Thank you for your interest in contributing to opencode-container-exec! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Security](#security)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

This project adheres to the Contributor Covenant [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment
4. Create a feature branch
5. Make your changes
6. Test your changes
7. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 18 or higher
- Docker with running devcontainers
- WSL (Windows Subsystem for Linux)
- devcontainer CLI (`npm install -g @devcontainers/cli`)

### Installation

```bash
# Clone your fork
git clone https://github.com/yourusername/opencode-container-exec.git
cd opencode-container-exec

# Install dependencies
npm install

# Run tests
npm test
```

### Project Structure

```
opencode-container-exec/
├── plugin/                 # Main plugin code
│   ├── index.js           # Runtime entrypoint (plugin exports only)
│   └── internal.js        # Internal helpers/utilities
├── scripts/               # Shell scripts
│   └── toggle.sh         # CLI toggle script
├── test/                  # Test files
│   ├── unit/             # Unit tests
│   └── fixtures/         # Test fixtures
├── package.json          # Package configuration
└── README.md             # Documentation
```

## Making Changes

### Code Style

- Use ES modules (`import/export`)
- Keep `plugin/index.js` exports limited to plugin entrypoint function(s); place helpers in `plugin/internal.js`
- Follow existing naming conventions
- Add JSDoc comments for public functions
- Keep functions focused and cohesive
- Prefer clarity over cleverness

### Security Considerations

- Validate all user inputs
- Use proper escaping for shell commands
- Set restrictive file permissions
- Log security events appropriately
- Never expose sensitive information in error messages

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Example:
```
feat(security): add input validation for container names

- Added validation for Docker container names
- Implemented strict pattern matching
- Added security logging for invalid inputs

Closes #123
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
node --test test/unit/state.test.js
```

### Writing Tests

- Place unit tests in `test/unit/`
- Use descriptive test names
- Test both success and failure cases
- Mock external dependencies
- Clean up test artifacts

### Test Coverage

Aim for high test coverage, especially for:
- Security-sensitive functions
- Input validation
- State management
- Error handling

## Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Report via [GitHub Security Advisory](https://github.com/isupervillain/opencode-container-exec/security)
3. Allow time for the issue to be addressed before public disclosure

### Security Review

All changes undergo security review. Pay special attention to:
- Command injection prevention
- Input validation
- File permissions
- Error handling
- State management

## Documentation

### When to Update Documentation

Update documentation when:
- Adding new features
- Changing existing behavior
- Adding configuration options
- Fixing bugs that affect usage
- Updating prerequisites

### Documentation Files

- `README.md`: Main documentation
- `CHANGELOG.md`: Version history
- `SECURITY_REVIEW.md`: Security analysis
- Inline code comments: Implementation details

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** with clear commits
3. **Test thoroughly** - all tests must pass
4. **Update documentation** if needed
5. **Submit PR** with clear description
6. **Address review feedback** promptly
7. **Squash commits** if requested

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

## Security Considerations
- [ ] Input validation added
- [ ] Command injection prevention
- [ ] File permissions secured
- [ ] Error handling reviewed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review performed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or documented)
```

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release commit
4. Create Git tag
5. Publish to npm
6. Create GitHub release

### Pre-release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Changelog updated
- [ ] Version bumped appropriately

## Getting Help

- **Issues**: Use GitHub issues for bugs and feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Report via [GitHub Security Advisory](https://github.com/isupervillain/opencode-container-exec/security)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
