# Testing the Monitor Plugin System - POC

## What Was Created

This POC demonstrates the new plugin-based architecture for monitors with the **Website Monitor** as a proof of concept.

### New Files Created:
1. **`frontend/js/monitors/registry.js`** - Monitor registry system (auto-discovery, form generation)
2. **`frontend/js/monitors/website-monitor.js`** - Website monitor as a plugin
3. **`frontend/services-poc.html`** - Test page demonstrating the plugin system

### What This POC Proves:
- ✅ Monitors can be self-contained modules
- ✅ Forms can be auto-generated from schema
- ✅ Validation works at plugin level
- ✅ Config extraction/population works
- ✅ System can load and register plugins dynamically
- ✅ Icons integrate with existing components.js

---

## How to Test

### Step 1: Ensure Docker Container is Running

```bash
cd /Users/gilles/Developer/SimpleWatch/simplewatch
docker-compose up -d
```

The container should already be running and will automatically serve the new files.

### Step 2: Open the POC Page

Navigate to: **http://localhost:5050/services-poc.html**

### Step 3: Verify Plugin System Loaded

You should see:
- ✅ "Plugin System Status" showing "Loaded 1 monitor plugin(s)"
- ✅ "Website Monitor (website)" listed
- ✅ Three test buttons

### Step 4: Test Form Generation

Click **"Test Form Generation"** button

**Expected Result:**
- HTML for the website monitor form is displayed
- Should show fields for: Service Name, URL, Timeout, Follow Redirects, Verify SSL, Check Interval

### Step 5: Test Validation

Click **"Test Validation"** button

**Expected Result:**
- Three test cases are validated
- First case (valid URL) should pass (error: null)
- Second case (invalid URL) should fail (error: "URL must start with http:// or https://")
- Third case (timeout > 60) should fail (error: "Timeout must be between 1 and 60 seconds")

### Step 6: Test Quick Monitor Flow

1. Click **"⚡ Quick Monitor (POC)"** button
2. You should see the modal with a "Website Monitor" card
3. The card should have a globe icon (if icons.js is loaded)
4. Click on the "Website Monitor" card
5. Form should appear with all fields

**Expected Fields:**
- Service Name (text input)
- URL (text input with placeholder "https://example.com")
- Timeout (seconds) (number input, default: 10)
- Follow Redirects (checkbox, checked by default)
- Verify SSL Certificate (checkbox, checked by default)
- Check Interval (dropdown with 5 options, default: "Every 5 minutes")

### Step 7: Test Form Submission

Fill out the form:
- **Service Name**: "Test Website"
- **URL**: "https://google.com"
- **Timeout**: 10
- Leave checkboxes as default
- Keep interval as "Every 5 minutes"

Click **"Create Monitor"**

**Expected Result:**
- Alert popup showing: "✅ Monitor configuration valid!"
- Alert shows the service name, monitor type, and interval
- Console shows the full config object
- Modal closes

### Step 8: Test Validation Errors

Try to create a monitor with invalid data:

**Test Case 1: Invalid URL**
- URL: "invalid-url" (missing http://)
- Click "Create Monitor"
- **Expected**: Alert saying "Validation error: URL must start with http:// or https://"

**Test Case 2: Invalid Timeout**
- URL: "https://example.com"
- Timeout: 100 (exceeds max of 60)
- Click "Create Monitor"
- **Expected**: Alert saying "Validation error: Timeout must be between 1 and 60 seconds"

### Step 9: Check Browser Console

Open Developer Tools (F12) → Console tab

**Expected Console Messages:**
```
Initializing Monitor Plugin System POC...
Loading monitor plugins...
Registering monitor: Website Monitor (website)
Loaded 1 monitor plugins
Plugin system initialized successfully
```

When you submit the form, you should see:
```
Selected monitor type: website
Extracted config: {url: "...", timeout_seconds: 10, ...}
Would create monitor: {service_name: "...", monitor_type: "website", ...}
```

### Step 10: Test Form Navigation

1. Open Quick Monitor modal
2. Click "Website Monitor"
3. Click "← Back" button
4. **Expected**: Returns to type selection screen
5. Click "Cancel" button
6. **Expected**: Modal closes

---

## What to Look For

### ✅ Success Indicators:
1. Plugin system loads without errors
2. Form is generated dynamically (not hardcoded in HTML)
3. All fields appear with correct types and defaults
4. Validation catches invalid input before submission
5. Config extraction works correctly
6. Console shows proper logging
7. Icon displays next to "Website Monitor"
8. No JavaScript errors in console

### ❌ Failure Indicators:
1. Console shows "Failed to load monitor plugins"
2. Form fields are missing or incorrect
3. Validation doesn't work
4. JavaScript errors in console
5. Modal doesn't open/close properly
6. Icon doesn't display

---

## Testing Checklist

- [ ] POC page loads without errors
- [ ] Plugin status shows 1 monitor loaded
- [ ] Test buttons work (Form Generation, Validation)
- [ ] Quick Monitor modal opens
- [ ] Website Monitor card displays with icon
- [ ] Clicking card shows configuration form
- [ ] All form fields render correctly
- [ ] Form defaults are set properly
- [ ] Back button returns to type selection
- [ ] Cancel button closes modal
- [ ] Valid config passes validation
- [ ] Invalid URL is caught by validation
- [ ] Invalid timeout is caught by validation
- [ ] Console shows proper debug messages
- [ ] No errors in browser console

---

## Troubleshooting

### Issue: "Failed to load monitor plugins"

**Possible Causes:**
1. ES6 module not supported (unlikely with modern browsers)
2. MIME type issue with .js files
3. Path issue in import statement

**Solution:**
- Check browser console for detailed error
- Ensure you're using Chrome/Firefox/Safari (modern browser)
- Verify files exist at correct paths

### Issue: Icon doesn't display

**Cause:** `components.js` not loaded or `icons.globe` not defined

**Solution:**
- Check that `components.js` is loaded (view page source)
- Verify `window.icons.globe` exists in console

### Issue: Form fields don't appear

**Cause:** Registry not rendering form correctly

**Solution:**
- Check console for errors
- Verify `monitorRegistry.renderForm()` is being called
- Check that `formFields` div exists in HTML

### Issue: Modal doesn't open

**Cause:** JavaScript function not defined

**Solution:**
- Check console for "showQuickMonitorModal is not defined"
- Verify script is loaded after DOM

---

## What's NOT Tested in This POC

This is a **proof of concept** focusing on:
- Plugin architecture
- Form generation
- Validation
- Config extraction

**Not included in POC (will be in full implementation):**
- Actual API calls to create monitors
- Edit monitor functionality
- Add to Service functionality
- Integration with existing services page
- All other monitor types (API, Port, SSL, etc.)
- Dashboard integration

---

## Success Criteria for POC

The POC is successful if:

1. ✅ **Plugin loads dynamically** - No hardcoded HTML for forms
2. ✅ **Form generates correctly** - All fields from schema appear
3. ✅ **Validation works** - Invalid input is caught before submission
4. ✅ **Config extraction works** - Form values are correctly extracted
5. ✅ **Code is maintainable** - Website monitor is ~90 lines in one file
6. ✅ **Easy to extend** - Clear path to add more monitors

---

## Next Steps After Successful POC

If POC tests pass:

1. **Review architecture** - Is this the right approach?
2. **Decide on full migration** - Convert all 6 monitor types?
3. **Plan integration** - How to integrate with existing services.html?
4. **Estimate effort** - How long for full migration?

If POC fails or needs changes:
1. **Identify issues** - What didn't work?
2. **Revise approach** - What needs to change?
3. **Test again** - Iterate until successful

---

## Quick Start Commands

```bash
# 1. Ensure container is running
cd /Users/gilles/Developer/SimpleWatch/simplewatch
docker-compose up -d

# 2. Open POC page
open http://localhost:5050/services-poc.html
# Or visit in browser: http://localhost:5050/services-poc.html

# 3. Check logs if needed
docker-compose logs -f simplewatch
```

---

## Files to Review

After testing, review these files to understand the architecture:

1. **`frontend/js/monitors/website-monitor.js`**
   - See how a monitor plugin is structured
   - Note the schema, validation, extract/populate methods
   - Compare to the 200+ lines of duplicated code in services.html

2. **`frontend/js/monitors/registry.js`**
   - See how plugins are registered and managed
   - Note the form generation logic
   - See how it would auto-discover monitors

3. **`frontend/services-poc.html`**
   - See how clean the HTML is (no forms!)
   - Note how it uses the registry to render everything
   - Compare to services.html (1934 lines)

---

## Questions to Answer During Testing

1. **Is form generation working correctly?**
   - Do all fields appear?
   - Are defaults set properly?
   - Do checkboxes work?

2. **Is validation effective?**
   - Does it catch invalid URLs?
   - Does it catch invalid timeout values?
   - Are error messages clear?

3. **Is the plugin structure maintainable?**
   - Is it easy to understand the website-monitor.js file?
   - Would it be easy to add another monitor?
   - Is the code cleaner than the current approach?

4. **Are there any technical issues?**
   - Any console errors?
   - Any MIME type issues with ES6 modules?
   - Any browser compatibility issues?

5. **Is this worth migrating?**
   - Does the benefit outweigh the effort?
   - Will this make adding monitors significantly easier?
   - Is the architecture sound?

---

## Reporting Results

After testing, document:

1. **What worked** ✅
2. **What didn't work** ❌
3. **Any errors encountered** 🐛
4. **Performance observations** 🚀
5. **Developer experience** 👨‍💻
6. **Recommendation: Proceed with full migration?** 👍/👎

---

## Contact

If you encounter issues or have questions about this POC, check:
- Browser console for detailed errors
- Docker logs: `docker-compose logs simplewatch`
- Network tab in DevTools for failed requests
