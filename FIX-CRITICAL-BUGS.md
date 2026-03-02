# Critical Bug Fixes - Task Board
**Date:** 2026-03-02 09:10 MST
**Bugs to Fix:** US-116, US-117, US-121, Mobile Scroll Sensitivity

---

## Bug #1: Mobile Scroll Sensitivity (HIGH)
**Issue:** Cards open modal while scrolling - no tap vs scroll discrimination
**Root Cause:** `isDragging = true` set on ANY touchmove, no movement threshold

### Fix: Add 10-15px Movement Threshold

```javascript
// BEFORE (lines ~4347-4375):
el.addEventListener('touchmove', () => {
  isDragging = true;
}, { passive: true });

// AFTER (with threshold):
let touchStartX = 0;
let touchStartY = 0;

el.addEventListener('touchstart', (e) => {
  touchStartTime = Date.now();
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isDragging = false;
}, { passive: true });

el.addEventListener('touchmove', (e) => {
  const touchX = e.touches[0].clientX;
  const touchY = e.touches[0].clientY;
  const deltaX = Math.abs(touchX - touchStartX);
  const deltaY = Math.abs(touchY - touchStartY);
  const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  // Only set isDragging if movement > 15px threshold
  if (movement > 15) {
    isDragging = true;
  }
}, { passive: true });
```

**Apply this fix to BOTH locations:**
1. Lines 4347-4375 (fallback card rendering)
2. Lines 4477-4510 (renderBoard card creation)

---

## Bug #2: Card Modal Not Opening (CRITICAL)
**Issues:** US-117, US-121
**Root Cause:** Multiple factors - event propagation, modal display logic

### Fix: Improve Modal Opening Logic

1. **Ensure modal.classList.add('active') is called**
2. **Check CSS for .modal-overlay.active display property**
3. **Add fallback if modal doesn't show**

```javascript
// In window.openCardModal function (line ~4603)
// After loading card data, ensure modal shows:

modal.classList.add('active');
document.body.style.overflow = 'hidden'; // Prevent background scroll

// Add timeout fallback
setTimeout(() => {
  if (!modal.classList.contains('active')) {
    console.error('[MODAL-ERROR] Modal failed to show, forcing display');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
  }
}, 100);
```

---

## Bug #3: Hamburger Menu Missing/Misplaced (US-116)
**Issue:** Navigation elements rendering outside container on production

### Fix: Verify CSS and HTML Structure

1. **Check hamburger menu CSS (line ~1576):**
```css
.hamburger-menu {
  position: fixed; /* Should be fixed, not absolute */
  top: 1rem;
  right: 1rem; /* Or left: 1rem for top-left */
  z-index: 1000;
  cursor: pointer;
  /* ... */
}
```

2. **Verify nav-menu CSS (line ~1627):**
```css
.nav-menu {
  position: fixed;
  top: 0;
  right: -250px; /* Start off-screen */
  width: 250px;
  height: 100vh;
  background: var(--surface-card);
  transition: right 0.3s ease;
  z-index: 999;
}

.nav-menu.active {
  right: 0; /* Slide in */
}
```

3. **Ensure toggleNav() function exists (line ~5035):**
```javascript
function toggleNav() {
  const navMenu = document.getElementById('navMenu');
  navMenu.classList.toggle('active');
}
```

---

## Bug #4: Add Eruda Console (MANDATORY)
**Missing:** Mobile debugging tool required by standard features

### Fix: Add Eruda Script Tags

```html
<!-- Add BEFORE closing </head> tag -->
<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
<script>
  // Initialize Eruda on mobile or when ?debug=true
  if (window.innerWidth < 768 || window.location.search.includes('debug=true')) {
    eruda.init();
  }
</script>
```

**Update footer to show debug status:**
```html
<footer style="...">
  <div style="max-width: 1200px; margin: 0 auto;">
    <div>© 2026 Task Board | <a href="?debug=true" style="color: var(--primary);">Enable Debug Console</a></div>
    <div style="font-size: 12px; color: var(--text-tertiary); margin-top: 0.5rem;">
      📱 Mobile debugging: Tap floating icon to open console
    </div>
  </div>
</footer>
```

---

## Implementation Plan

1. **Backup current index.html:**
   ```bash
   cp index.html index.html.backup-$(date +%Y%m%d-%H%M%S)
   ```

2. **Apply fixes in order:**
   - Add Eruda console (near line 7, before </head>)
   - Fix touch event thresholds (lines 4347-4375, 4477-4510)
   - Verify/fix modal display logic (line ~4603)
   - Verify hamburger menu CSS (lines 1576, 1627)
   - Update footer (line 1941)

3. **Test each fix:**
   ```bash
   # Reload http://localhost:8000
   # Test on mobile viewport (Chrome DevTools)
   # Verify:
   # - Eruda console appears (floating icon)
   # - Scrolling doesn't open modals
   # - Tapping cards opens modal reliably
   # - Hamburger menu visible and functional
   ```

4. **Commit fixes:**
   ```bash
   git add index.html
   git commit -m "Fix critical bugs: mobile scroll sensitivity, modal opening, add Eruda console"
   ```

---

## Success Criteria

- [x] Bug fixes documented
- [ ] Eruda console added and visible on mobile
- [ ] Scrolling through cards does NOT open modals
- [ ] Tapping cards DOES open modal reliably
- [ ] Hamburger menu visible and functional
- [ ] All fixes tested on mobile viewport
- [ ] Committed with clear message
- [ ] Deployed to production
- [ ] Screenshot proof captured

---

## Testing Checklist

**Mobile Viewport (Chrome DevTools - iPhone 14 Pro, 393x852):**
1. [ ] Eruda icon visible (bottom-right floating button)
2. [ ] Tap Eruda icon → console opens
3. [ ] Scroll through cards → no modals open
4. [ ] Tap card while stationary → modal opens
5. [ ] Tap outside modal → modal closes
6. [ ] Hamburger menu visible (top-right)
7. [ ] Tap hamburger → nav menu slides in
8. [ ] Tap outside nav → nav closes
9. [ ] Dark/light mode toggle works
10. [ ] Footer visible with debug link

**Desktop (1920x1080):**
1. [ ] Click card → modal opens
2. [ ] Hamburger menu hidden (desktop nav shows instead)
3. [ ] All interactions smooth and responsive

---

## Next Steps After Fixes

1. Run full standard features audit
2. Fix remaining bugs (if any)
3. Deploy to production
4. Capture screenshots
5. Generate final compliance report
