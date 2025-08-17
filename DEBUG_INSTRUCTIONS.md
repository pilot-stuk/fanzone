# Debug Instructions for Registration Issue

## To test the registration flow:

### 1. Clear all data (run in browser console):
```javascript
// Clear registration state
localStorage.removeItem('fanzone_registration_state');
localStorage.removeItem('fanzone_auth_token');
localStorage.removeItem('fanzone_current_user');

// Check current state
window.FanZoneApp.debugRegistration();
```

### 2. Force clear registration and reload:
```javascript
window.FanZoneApp.clearRegistrationState();
location.reload();
```

### 3. Check registration state at any time:
```javascript
window.FanZoneApp.debugRegistration();
```

### 4. What SHOULD happen:

1. **New User (Fresh Start)**:
   - Open app → No registration state
   - "Start Collecting" button should be visible
   - Gifts page shows lock screen with registration prompt
   - Cannot purchase gifts

2. **After clicking "Start Collecting"**:
   - User authenticated and created in database
   - Registration state saved
   - Button disappears
   - Gifts become accessible

3. **Returning User**:
   - Registration state loaded from localStorage
   - No button shown
   - Can access gifts immediately

### 5. Check if button is showing:
```javascript
// In Telegram
console.log('Platform available:', window.DIContainer.get('platformAdapter').isAvailable());

// Check main button
window.Telegram?.WebApp?.MainButton?.isVisible
```

### 6. If registration is stuck, force reset:
```javascript
window.FanZoneApp.clearRegistrationState();
window.FanZoneApp.setupTelegramUI();
```