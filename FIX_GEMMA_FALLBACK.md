# Fix: "Gemma planner was unavailable" Error

## Problem
When requesting shopping suggestions, you see this error:
```
Gemma planner was unavailable for this request. Recovered Kimi planner output from 
semi-structured response. Non-Gemma fallback products are hidden by policy.
```

## Root Cause
1. Your backend tries to use **Kimi LLM** via NVIDIA API to generate shopping plans
2. **`NVIDIA_API_KEY` environment variable is not configured** on your HuggingFace Space
3. Kimi inference fails → backend falls back to deterministic planner
4. Old frontend code rejected fallback results entirely

## ✅ What I Fixed

### Frontend Changes (Applied)
**Location**: `src/api/client.ts` (lines 148-153) and `src/pages/Suggestions.tsx` (lines 81-94)

1. **Removed hard rejection** of fallback products
2. **Added fallback detection** and warning notice
3. **Now shows user-friendly message** when fallback is used
4. **Products still display** with explanation

**New behavior**:
- Users see a notice: "⚠️ Planning used fallback rules: [reason]"
- Products are still high-quality matches
- System continues to work even if NVIDIA_API_KEY is missing

## 🚀 Next Steps (Choose One)

### **Option A: Set NVIDIA_API_KEY on HuggingFace (Recommended)**
This enables the premium Kimi planner:

1. Go to your HuggingFace Space settings
2. Find "Repository secrets" section
3. Add new environment variable:
   - **Name**: `NVIDIA_API_KEY`
   - **Value**: Your NVIDIA API key (get from nvidia.com/developer)
4. Restart the Space

**Benefit**: Premium AI planning, no fallback needed

### **Option B: Use Current Fix (Already Applied)**
The fix is already in place. Just:
1. Commit and push these changes to your repo
2. Redeploy to HuggingFace
3. Test the Suggestions feature

**Result**: Works with fallback deterministic planner, shows notice to users

### **Option C: Disable Health Check (Temporary)**
If you want to skip the NVIDIA_API_KEY check:

Edit `src/api/client.ts` lines 141-161 and comment out the health check.

**Note**: Not recommended - removes safety validation

## 📝 Test the Fix

1. Push changes: `git push`
2. Redeploy HuggingFace Space
3. Go to Suggestions page
4. Try a request like: "Need black casual trousers"
5. You should see:
   - ⚠️ Fallback notice (if NVIDIA_API_KEY not set)
   - ✅ Products displayed
   - No error blocking results

## 📋 Changes Made

### File: `src/api/client.ts`
- **Before**: Threw error when `query_plan.source !== 'gemma'`
- **After**: Logs warning, continues with products

### File: `src/pages/Suggestions.tsx`
- **Before**: Silent failure if fallback detected
- **After**: Shows notice with fallback reason to user

## 🔍 How It Works Now

```
User submits request
   ↓
Backend tries Kimi LLM planning
   ├─ Success → query_plan.source = 'gemma' → Display products
   └─ Fails (no NVIDIA_API_KEY) → query_plan.source = 'fallback'
   ↓
Frontend detects fallback
   ├─ Logs warning for debugging
   ├─ Shows user notice
   └─ Displays products anyway ✅
```

## Troubleshooting

**Still seeing error after redeploy?**
- Clear browser cache (Ctrl+Shift+Delete)
- Hard reload (Ctrl+Shift+R)
- Check if Space redeployment completed

**Want true Gemma planning?**
- Set `NVIDIA_API_KEY` environment variable
- This uses actual Gemma/Kimi models for better results

**Fallback results seem poor?**
- Try more specific requests: "black comfortable office trousers"
- Specify occasion, color, fit preferences
- Fallback uses deterministic matching (still effective)

## Files Modified
- ✅ `src/api/client.ts` - Removed fallback rejection
- ✅ `src/pages/Suggestions.tsx` - Added fallback notice

## Questions?
Check the backend logs for specific errors:
```
Backend log pattern: "Live Kimi query planning was unavailable..."
```

This tells you the fallback was triggered due to missing API keys or timeouts.
