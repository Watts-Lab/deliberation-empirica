# Deliberation Empirica Platform

Deliberation Empirica is an experimental social science platform built with the Empirica framework for conducting small group deliberation experiments. The platform consists of a React client, Node.js server, Etherpad integration, and comprehensive test infrastructure.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites and Installation
Before working with this codebase, you must install these dependencies:
- Install Node.js v20+ (available in environment)
- Install Docker (available in environment) 
- Install Empirica CLI: `curl https://install.empirica.dev | sh`
  - **NOTE**: Empirica installation may fail due to network restrictions. See workarounds below.

### Core Build Commands
- Create `.env` file (see template below) - REQUIRED for any development work
- Bootstrap dependencies:
  - Server: `cd server && npm install` -- takes 10 seconds. NEVER CANCEL.
  - Client: `cd client && npm install` -- takes 16 seconds. NEVER CANCEL.
- Build client: `cd client && npm run build` -- takes 17 seconds. NEVER CANCEL.
- Build server: `cd server && npm run build` -- takes 0.5 seconds. NEVER CANCEL.
- Full project build: `npm run build` -- takes 3+ minutes if Docker/Empirica work. NEVER CANCEL. Set timeout to 10+ minutes.

### Test Commands
- Server unit tests: `cd server && npm run test` -- takes 7 seconds. NEVER CANCEL. Set timeout to 30+ minutes.
  - Runs 64+ tests with vitest
  - Tests pass successfully and validate core functionality
- Code style checking: `npm run lint` -- takes 11 seconds. NEVER CANCEL. Set timeout to 30+ minutes.
  - Runs ESLint on client, server, and cypress code
  - Expect ~37 style issues in active development (normal)
- End-to-end tests: `cd cypress && npm install && npm run test` -- takes 20+ minutes. NEVER CANCEL. Set timeout to 30+ minutes.
  - **NOTE**: Cypress installation may fail due to network restrictions

### Environment Setup (.env file)
Always create this `.env` file in the repository root before any development work:
```
DAILY_APIKEY=none
QUALTRICS_API_TOKEN=none
QUALTRICS_DATACENTER=none
ETHERPAD_API_KEY=none
ETHERPAD_BASE_URL=none
DELIBERATION_MACHINE_USER_TOKEN=none
EMPIRICA_ADMIN_PW=localpwd
TEST_CONTROLS=enabled
GITHUB_PRIVATE_DATA_OWNER=none
GITHUB_PUBLIC_DATA_OWNER=none
GITHUB_PRIVATE_DATA_REPO=none
GITHUB_PRIVATE_DATA_BRANCH=none
GITHUB_PUBLIC_DATA_REPO=none
GITHUB_PUBLIC_DATA_BRANCH=none
```

### Development Server
- Start development environment: `npm run start` -- REQUIRES full build first
  - Starts Empirica server on http://localhost:3000
  - Starts mock CDN on port 9091
  - Starts Etherpad container on port 9001
- Access admin interface: http://localhost:3000/admin
- Access participant interface: http://localhost:3000/

## Validation

### Known Working Components
- ALWAYS run through complete build validation when making changes to core functionality
- Server unit tests provide reliable validation of core logic
- Client and server can be built independently using standard npm tools
- ESLint validation works and should be run before committing code

### Network-Restricted Environment Workarounds
If Empirica CLI installation fails:
- Individual component builds work: `cd client && npm run build` and `cd server && npm run build`
- Server tests work independently: `cd server && npm run test` 
- Code style checking works: `npm run lint`
- Docker container builds may fail due to network restrictions
- Cypress e2e tests may not install due to network restrictions

### Validation Examples
Test basic experiment configuration:
```json
{
  "batchName": "labDemo",
  "treatmentFile": "projects/example/cypress.treatments.yaml",
  "dispatchWait": 1,
  "treatments": ["demo1p"]
}
```

### Testing Scenarios
When making changes, always test these core scenarios:
1. Server unit tests must pass: `cd server && npm run test`
2. Code style must be clean: `npm run lint` (fix critical errors)
3. Both client and server must build successfully
4. If possible, test admin interface setup and basic user flow
5. Validate configuration files with example treatments in `cypress/fixtures/mockCDN/projects/example/`

## Common Tasks

### Repository Structure
```
deliberation-empirica/
├── server/           # Node.js server with Empirica integration
├── client/           # React client with Vite build system  
├── cypress/          # End-to-end test infrastructure
├── etherpad/         # Docker configuration for collaborative editing
├── .github/          # CI/CD workflows and issue templates
├── docs/             # Documentation and configuration guides
├── package.json      # Root dependencies and script shortcuts
├── builder.sh        # Build script for Docker + Empirica setup
└── runner.sh         # Development server startup script
```

### Key Files to Know
- `package.json` - Root package with ESLint and build shortcuts
- `server/src/index.js` - Main server entry point
- `client/src/App.jsx` - Main React application
- `cypress/e2e/` - End-to-end test scenarios (14 test files)
- `docs/preflightChecklist.md` - Production deployment guide
- `docs/batchConfig.md` - Experiment configuration reference
- `docs/treatments.md` - Treatment file format documentation
- `cypress/fixtures/mockCDN/projects/example/` - Example treatment and configuration files

### Common Development Patterns
- Always validate configuration with server tests: `cd server && npm run test`
- Treatment files are defined in YAML format (see docs/treatments.md)
- Experiment batches are configured via JSON (see docs/batchConfig.md)
- Video conferencing integration uses Daily.co API
- Data export integrates with GitHub repositories
- Etherpad provides collaborative text editing features

### CI/CD Information
Based on `.github/workflows/`:
- Cypress tests run with 20-minute timeout in CI
- Server vitest tests run with 5-minute timeout in CI  
- ESLint checks must pass for code quality
- Container images are built and published for production deployment
- Multiple test containers run in parallel for efficiency

### Troubleshooting
- If Empirica data corruption occurs, delete `./empirica/local/tajriba.json`
- Check Docker service status if container builds fail
- Verify `.env` file exists and has correct format
- Network connectivity issues may prevent external service installations
- Use individual component builds as fallback when full build fails

## Critical Build Timing Expectations
- **NEVER CANCEL** any npm install, build, or test command
- npm install (server): 10 seconds
- npm install (client): 16 seconds  
- Client build: 17 seconds
- Server build: 0.5 seconds
- Server tests: 7 seconds
- ESLint: 11 seconds
- Full build: 3+ minutes (varies with network)
- Cypress tests: 20+ minutes
- Always set timeouts of 30+ minutes for any build/test command to prevent premature cancellation