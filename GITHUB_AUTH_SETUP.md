# GitHub Authentication Setup

## Option 1: Personal Access Token (Recommended)

### Step 1: Create a Personal Access Token on GitHub

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `Tv-Led-backend-push`
4. Select expiration: Choose your preference (90 days, 1 year, or no expiration)
5. Select scopes: Check **`repo`** (Full control of private repositories)
6. Click **"Generate token"**
7. **IMPORTANT**: Copy the token immediately (you won't see it again!)

### Step 2: Use the Token to Push

When you run `git push`, it will ask for:
- **Username**: Your GitHub username
- **Password**: Paste your Personal Access Token (NOT your GitHub password)

---

## Option 2: Use Git Credential Manager (Windows)

Windows Git Credential Manager can store your credentials:

```bash
git config --global credential.helper manager-core
```

Then when you push, it will open a browser window for GitHub authentication.

---

## Option 3: SSH Keys (More Secure)

If you prefer SSH:

1. Generate SSH key:
```bash
ssh-keygen -t ed25519 -C "mouhamedaminemejri@esprit.tn"
```

2. Add SSH key to GitHub:
   - Copy the public key: `cat ~/.ssh/id_ed25519.pub`
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Paste and save

3. Change remote URL:
```bash
git remote set-url origin git@github.com:testingcpompanysignintesting-oss/Tv-Led-backend.git
```

---

## Quick Push Command

After setting up authentication, run:
```bash
git push -u origin main
```
