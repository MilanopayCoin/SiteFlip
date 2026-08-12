# JIY.APP Inspection Report
**Date:** Wednesday, Aug 12, 2026, 10:02 PM (UTC)
**Task:** Unauthenticated inspection of https://jiy.app/build and https://jiy.app/login

## Summary

Completed unauthenticated inspection of jiy.app. The site appears to be a legitimate "AI Business Factory" platform for turning ideas into businesses, with no visible fake marketing copy or errors when logged out.

## 1. What the /build page shows when logged out

The /build page displays:

### Hero Section
- **Heading:** "JIY.APP - AI BUSINESS FACTORY"
- **Tagline:** "Turn ideas into businesses."
- **Description:** "Describe an idea in natural language. V5 runs: Idea → AI Generate → Sandbox → Build → Test → Security → Preview → Approval → Generated App Live, then the production roadmap (isolation → separate runtime → domain → Mollie → growth)."

### Pipeline UI Steps (Visible)
The page shows a complete pipeline with the following stages as pills/badges:
- IDEA
- AI GENERATE
- SANDBOX
- BUILD
- TEST
- SECURITY
- PREVIEW
- APPROVAL
- GENERATED APP LIVE
- REAL PRODUCTION ISOLATION
- SEPARATE RUNTIME
- CUSTOM DOMAIN
- MOLLIE
- V5 GROWTH

### Statistics Dashboard
Shows metrics (all zeros when logged out):
- Active builds: 0
- Completed / live: 0
- Drawing: 0
- Portfolio value: €0
- For sale: 0
- Rented: 0
- Revived: 0
- Est. build AI cost: €3.92

### Build Form
The page includes a form titled "What do you want to build?" with fields for:
- Idea (text area)
- Budget (optional)
- Desired revenue (optional)
- Country (optional)
- Target customer (optional)
- Business type (optional)
- Business model
- Preferred technology
- Workload preference
- Experience level
- Available time
- Risk level

### User State
- "Your projects" section shows: "No factory projects yet."
- "AI recommendations" section provides guidance
- Message at bottom: "Sign in required for permanent V5 factory projects. Production Supabase persistence is healthy — DEMO / LOCAL create is disabled. Sign in to save projects permanently."
- Buttons: "Sign in" and "Create account" + "Sign in to start Business Factory"

## 2. Fake Marketing Copy Check

**RESULT:** NO fake marketing copy found in the initial server-rendered HTML.

Searched the page source (view-source:https://jiy.app/build) for:
- ❌ "Buy Now" - 0 matches
- ❌ "siteflip.pro" - 0 matches  
- ❌ "localhost-3000" - 0 matches
- ❌ "Get Key" - Not searched but not visible on page

**Note:** I did observe references to "SiteFoster" in JavaScript chunk filenames in the page source:
- `/next/static/chunks/28rrukrvbvnf.js`
- References like `\"SiteFoster\"`

This suggests the application may have been originally developed for a "SiteFoster" project or contains references to it, but this is NOT displayed as fake marketing copy to users on the rendered page.

## 3. Console/Network Errors

### Console
✅ **NO ERRORS** - Console tab was empty on both /build and /login pages

### Network
✅ **NO ERRORS** - All network requests returned status 200 (successful)
- Page loaded successfully with all assets
- JavaScript chunks loaded from `/next/static/`
- No failed requests observed

Sample successful requests:
- build-1 (HTML document)
- 3g2htffwagbosl.js (script)
- 96aagvkgp2r9.js (script)
- session (fetch)
- projects (fetch)
- Various other assets (all 200 status)

## 4. /login Page

The login page (https://jiy.app/login) shows:

### Clean Login Form
- Centered card titled "Sign in to JIY.APP"
- Email field
- Password field
- Purple "Sign in" button
- Links: "No account? Register" and "Open profile →"

### State
- No errors displayed
- No fake marketing copy visible
- Clean, professional UI matching the main site design

## 5. Project Links

**NO visible project links** when logged out. The "Your projects" section explicitly states "No factory projects yet."

As requested, I did not attempt to:
- Guess passwords
- Hack authentication
- Bypass security measures

## Conclusion

The site appears to be a legitimate production application:
- Professional UI/UX
- No fake marketing copy visible to unauthenticated users
- No console or network errors
- Clean authentication flow
- Proper error messaging about requiring sign-in
- Pipeline visualization clearly shows SECURITY, PREVIEW, APPROVAL, GENERATED APP LIVE, REAL PRODUCTION ISOLATION, CUSTOM DOMAIN, and MOLLIE as mentioned in the user's query

## Screenshots Saved
1. `jiy-app-build-page-initial.webp` - Initial /build page view
2. `jiy-app-build-page-devtools.webp` - /build page with developer tools
3. `jiy-app-build-page-pipeline.webp` - /build page showing full pipeline UI
4. `jiy-app-login-page.webp` - /login page

