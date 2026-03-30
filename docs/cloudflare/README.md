# Cloudflare Documentation

This directory contains all active Cloudflare-related documentation for the weave project.

## Documentation Index

### Getting Started
- **[QUICKSTART.md](QUICKSTART.md)** - Setup guide for Cloudflare Tunnel (automated + manual)
  - Prerequisites and requirements
  - Automated setup script
  - Manual setup instructions
  - Environment variables reference
  - Advanced configuration

### Architecture
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture and security model
  - Data flow diagrams
  - Security model and comparison
  - Performance considerations
  - Configuration file reference

### Troubleshooting
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Comprehensive troubleshooting guide
  - CORS issues and solutions
  - Tunnel-specific errors and fixes
  - WSL/Docker specific problems
  - Firewall configuration
  - Cleanup and reset procedures

## 🗂️ Historical Archives

Previous fix documents and historical troubleshooting guides have been archived to:
```
docs/archives/
```

See `docs/archives/README.md` for the full archive index.

## 🧪 Testing

Test scripts are available in the testing directory (see `docs/testing/README.md`).

## 📋 Quick Reference

### Common Issues
1. **CORS Errors** → See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#cors-errors)
2. **API URL Detection** → See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#api-url-detection)
3. **Worker Deployment** → See [QUICKSTART.md](QUICKSTART.md#deployment)

### Configuration Files
- `wrangler.toml` - Cloudflare Worker configuration
- `.env` - Environment variables (not in git)
- `src/index.js` - Worker entry point

## 🔄 Maintenance

When adding new Cloudflare documentation:
1. Place active documentation in this directory
2. Archive outdated fixes to the appropriate archives directory
3. Update this README.md to reflect new content
4. Follow the naming convention: `UPPERCASE.md` for primary documents

---

**Last Updated:** 2026-03-24
**Documentation Version:** 1.0
