# Authentication Module - Environment Variables Setup

## Required Environment Variables

Add these to your `.env` file:

### JWT Configuration

```env
# JWT Secret (REQUIRED - Change in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-characters
JWT_EXPIRES_IN=7d

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3000
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API** (or **Google Identity API**)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add authorized redirect URI: `http://localhost:3001/api/auth/google/callback`
7. Copy **Client ID** and **Client Secret**

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
```

**Production:** Update `GOOGLE_CALLBACK_URL` to your production URL:
```
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
```

### Facebook OAuth Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app (or use existing)
3. Add **Facebook Login** product
4. Go to **Settings** → **Basic**
5. Add **Valid OAuth Redirect URIs**: `http://localhost:3001/api/auth/facebook/callback`
6. Copy **App ID** and **App Secret**

```env
# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:3001/api/auth/facebook/callback
```

**Production:** Update `FACEBOOK_CALLBACK_URL` to your production URL:
```
FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/auth/facebook/callback
```

### Apple OAuth Setup (Optional - Complex)

Apple Sign-In requires significant setup:

1. **Apple Developer Account** (paid membership required)
2. **App ID** with "Sign in with Apple" capability enabled
3. **Service ID** configured with your domain
4. **Private Key** (.p8 file) downloaded from Apple Developer
5. **Domain verification** completed

```env
# Apple OAuth (Optional - requires Apple Developer setup)
APPLE_CLIENT_ID=your-apple-service-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_KEY_FILE_PATH=/path/to/AuthKey_XXXXXXXXXX.p8
APPLE_CALLBACK_URL=http://localhost:3001/api/auth/apple/callback
```

**Note:** Apple OAuth is more complex and requires proper JWT token verification. The current implementation includes a placeholder. For production, consider using a library like `@apple/auth-library-nodejs` or implementing proper Apple ID token verification.

---

## Complete .env Example

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Server
PORT=3001
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-characters
JWT_EXPIRES_IN=7d

# Frontend
FRONTEND_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Facebook OAuth
FACEBOOK_APP_ID=1234567890123456
FACEBOOK_APP_SECRET=abcdefghijklmnopqrstuvwxyz123456
FACEBOOK_CALLBACK_URL=http://localhost:3001/api/auth/facebook/callback

# Apple OAuth (Optional)
# APPLE_CLIENT_ID=com.yourcompany.yourapp
# APPLE_TEAM_ID=ABCD123456
# APPLE_KEY_ID=XYZ1234567
# APPLE_KEY_FILE_PATH=./keys/AuthKey_XYZ1234567.p8
# APPLE_CALLBACK_URL=http://localhost:3001/api/auth/apple/callback
```

---

## Security Best Practices

1. **Never commit `.env` file** to version control
2. **Use strong JWT_SECRET** (minimum 32 characters, random)
3. **Use different secrets** for development and production
4. **Rotate secrets** periodically in production
5. **Use HTTPS** in production for OAuth callbacks
6. **Validate OAuth redirect URLs** match your domain
7. **Keep OAuth credentials secure** and rotate them if compromised

---

## Testing OAuth Locally

For local development, you can use:
- **ngrok** or **localtunnel** to expose your local server
- Update OAuth provider redirect URLs to use the tunnel URL
- Example: `https://abc123.ngrok.io/api/auth/google/callback`

---

## Production Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Update all OAuth callback URLs to production domain
- [ ] Enable HTTPS
- [ ] Verify OAuth app settings in provider dashboards
- [ ] Test all OAuth flows in production
- [ ] Set up proper error logging
- [ ] Configure CORS properly for production domain
- [ ] Review and update `FRONTEND_URL` for production
