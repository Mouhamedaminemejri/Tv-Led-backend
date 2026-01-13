# Create GitHub Repository - Quick Instructions

## Option 1: Create via GitHub Website (Easiest)

1. Go to: **https://github.com/new**
2. Repository name: **Tv-Led-backend**
3. Description: "TV LED Backend - NestJS eCommerce API with Authentication"
4. Choose: **Public** or **Private**
5. **DO NOT** check:
   - ❌ Add a README file
   - ❌ Add .gitignore
   - ❌ Choose a license
6. Click **"Create repository"**

## Option 2: Create via GitHub CLI (if installed)

```bash
gh repo create Mouhamedaminemejri/Tv-Led-backend --public --description "TV LED Backend - NestJS eCommerce API"
```

## After Creating the Repository

Once the repository is created, run:
```bash
git push -u origin main
```

You'll be prompted for credentials:
- **Username**: `Mouhamedaminemejri`
- **Password**: Use a **Personal Access Token** (not your GitHub password)

### Create Personal Access Token:
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name: `Tv-Led-backend-push`
4. Expiration: Your choice
5. Scopes: Check **`repo`**
6. Generate and copy the token
7. Use this token as your password when pushing
