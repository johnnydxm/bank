# 🤝 Contributing to Formance Stack Project

Thank you for your interest in contributing! This document provides guidelines and best practices for contributing to this project.

## 🎯 Getting Started

### Prerequisites
- Docker Desktop (5GB+ RAM)
- Git
- Go 1.22+
- Node.js 18+
- SuperClaude framework (optional but recommended)

### Local Development Setup
```bash
# Clone the repository
git clone https://github.com/johnnydxm/bank.git
cd bank

# Start development environment
docker compose up -d

# Run tests
make test
```

## 📋 Development Workflow

### 1. Fork and Branch
```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/bank.git
cd bank

# Create a feature branch
git checkout -b feature/amazing-feature
```

### 2. Development with SuperClaude
Use SuperClaude commands for enhanced development:

```bash
# Analyze architecture before changes
/analyze --architecture --persona-architect

# Review code quality
/review --quality --evidence --persona-qa

# Test your changes
/test --integration --e2e --coverage

# Security scan
/scan --security --deps --persona-security
```

### 3. Code Standards

#### Conventional Commits
We use conventional commits for clear, semantic commit messages:

```bash
# Set up commit message template
git config commit.template .gitmessage

# Examples
git commit -m "feat(ledger): add transaction validation"
git commit -m "fix(payments): resolve connector timeout"
git commit -m "docs(api): update endpoint documentation"
```

#### Code Quality Standards
- **Go**: Follow `gofmt`, `golint`, and `go vet` standards
- **Testing**: Maintain 80%+ test coverage
- **Documentation**: Update docs for API changes
- **Security**: Run security scans before PR

### 4. Testing Requirements

#### Unit Tests
```bash
# Run unit tests
make test

# With coverage
make test-coverage
```

#### Integration Tests
```bash
# Start test environment
docker compose -f docker-compose.test.yml up -d

# Run integration tests
cd tests/integration && task tests

# Clean up
docker compose -f docker-compose.test.yml down
```

#### Performance Tests
```bash
# Run load tests
cd tests/loadtesting && task tests

# Benchmark tests
cd tests/benchmarks && task run
```

## 🔒 Security Guidelines

### Security First Development
- Never commit secrets or API keys
- Use environment variables for configuration
- Run security scans on all changes
- Follow OWASP security practices

### Security Testing
```bash
# Run security analysis
/scan --security --owasp --deps --persona-security

# Dependency vulnerability scan
make security-scan

# Container security scan
make container-scan
```

## 📊 Code Review Process

### Before Submitting PR
1. **Self Review with SuperClaude**:
   ```bash
   /review --quality --security --evidence --persona-qa
   ```

2. **Run Full Test Suite**:
   ```bash
   make test-all
   ```

3. **Security and Quality Checks**:
   ```bash
   make lint
   make security-scan
   make dependency-check
   ```

### PR Guidelines
- **Title**: Use conventional commit format
- **Description**: Include context, changes, and testing
- **Testing**: Document test scenarios
- **Breaking Changes**: Clearly mark and document
- **Screenshots**: Include for UI changes

### Review Criteria
- ✅ Code follows project standards
- ✅ Tests are comprehensive and passing
- ✅ Documentation is updated
- ✅ Security scans pass
- ✅ Performance impact is acceptable
- ✅ Breaking changes are documented

## 🎭 Using SuperClaude for Contributions

### Development Commands
```bash
# Setup development environment
/dev-setup --full --monitoring --docs

# Analyze system impact
/analyze --performance --impact --persona-architect

# Code quality review
/review --standards --best-practices --persona-qa

# Troubleshoot issues
/troubleshoot --investigate --debug --persona-analyzer
```

### Documentation Commands
```bash
# Generate API documentation
/document --api --openapi --examples

# Create architecture diagrams
/explain --visual --architecture --depth expert

# Update README
/document --readme --features --usage
```

## 🏗️ Architecture Guidelines

### Microservices Principles
- **Single Responsibility**: Each service owns one domain
- **Event-Driven**: Use NATS for service communication
- **Database per Service**: Maintain data isolation
- **API-First**: Design APIs before implementation

### Event System
- Use structured events with schema validation
- Follow event versioning guidelines
- Implement idempotent event handlers
- Monitor event delivery and processing

### Security Architecture
- Zero-trust networking
- Service-to-service authentication
- Encrypted data at rest and in transit
- Regular security audits

## 🧪 Testing Strategy

### Test Pyramid
1. **Unit Tests**: Fast, isolated component tests
2. **Integration Tests**: Service interaction tests
3. **Contract Tests**: API contract validation
4. **E2E Tests**: Full system workflow tests
5. **Performance Tests**: Load and stress testing

### Test Data Management
- Use factories for test data generation
- Clean up test data after tests
- Use realistic but anonymized data
- Test with various data scenarios

## 🚀 Deployment Guidelines

### Environment Strategy
- **Development**: Local Docker Compose
- **Staging**: Kubernetes with staging data
- **Production**: Kubernetes with production safeguards

### CI/CD Pipeline
- Automated testing on all PRs
- Security scanning required
- Performance regression detection
- Automated deployment to staging

## 📚 Documentation Standards

### Code Documentation
- **Go**: Use godoc format for public APIs
- **API**: OpenAPI/Swagger specifications
- **Architecture**: Decision records (ADRs)
- **Setup**: Comprehensive README files

### Documentation Commands
```bash
# Generate documentation
make docs

# Update API specs
make api-docs

# Architecture documentation
/document --architecture --decisions
```

## 🏷️ Labeling and Project Management

### Issue Labels
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to docs
- `security` - Security-related issues
- `performance` - Performance improvements
- `good first issue` - Good for newcomers

### Project Boards
- **Backlog**: Planned features and improvements
- **In Progress**: Currently being worked on
- **Review**: Under code review
- **Testing**: In QA/testing phase
- **Done**: Completed and deployed

## 🆘 Getting Help

### Resources
- 📖 [Project Documentation](docs/)
- 💬 [GitHub Discussions](https://github.com/johnnydxm/bank/discussions)
- 🐛 [Issue Tracker](https://github.com/johnnydxm/bank/issues)
- 🔧 [SuperClaude Framework](https://github.com/NomenAK/SuperClaude)

### Community Guidelines
- Be respectful and inclusive
- Help others learn and grow
- Share knowledge and best practices
- Provide constructive feedback

### SuperClaude Support
```bash
# Framework troubleshooting
/troubleshoot --introspect --superclaude

# Get help with commands
/help --commands --examples

# Community best practices
/analyze --community --standards
```

## 🏆 Recognition

Contributors will be recognized in:
- README contributors section
- Release notes for significant contributions
- GitHub contributor graphs
- Community highlights

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to building better financial infrastructure! 🏦✨**

*Built with SuperClaude framework for enhanced development productivity*