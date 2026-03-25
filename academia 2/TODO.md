# Admin Dashboard Enrollments Fix - Render 500 Issue

## Plan Status
- [x] 1. Analysis: Local F12 no errors, Supabase enrollments ✓, Render logs clean
- [x] 2. Files read: admin.js, admin-dashboard.js, package.json, index.js, db.js, auth.js
- [ ] 3. Edit db.js: Fix dotenv path Render-safe
- [ ] 4. Edit render.yaml: PORT $PORT dynamic
- [ ] 5. Test local → Git push → Render redeploy
- [ ] 6. Verify /api/admin/enrollments logs + data

## Root Cause
- Local: Works (no F12 errors)
- Render: No request logs → Env vars fail → auth fail → Supabase undefined
- db.js: dotenv('../.env') → backend/.env not exist on Render
- render.yaml: PORT 10000 → Backend 5000 conflict

## Render Env Check
1. Render dashboard → Environment → SUPABASE_URL/KEY/JWT_SECRET ✓
2. Logs → No "injecting env" → Vars missing

## Fixes
```
db.js:
require('dotenv').config(); // No path

render.yaml:
- key: PORT  
  value: $PORT  # Dynamic

admin.js /enrollments: FKey safe ✓ logging ✓
```

**Current:** 2/6 → Ready edits + deploy!

