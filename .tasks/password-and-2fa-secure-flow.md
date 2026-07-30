---
Priority: High Impact
Description: Build the `AccountSettingsComponent`. This section must handle sensitive operations (password change, 2FA setup) by enforcing strict security guard patterns, requiring re-authentication (re-entering password/OTP) before submitting the form.
Technical Implementation: Implement custom Angular Guard logic that intercepts the form submission event, triggering a modal step for secondary authentication (password confirmation or TOTP input) before allowing the API call to proceed.
---

