# Setup Instructions for New Machine

## Quick Fix for TypeScript Errors

If you're getting Prisma client type errors after pulling the code:

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Regenerate Prisma Client
```bash
# Delete old Prisma client (if exists)
rm -rf node_modules/.prisma

# Regenerate Prisma client
npx prisma generate
```

### Step 3: Check Database Migrations
```bash
# Check migration status
npx prisma migrate status

# If migrations are pending, apply them
npx prisma migrate deploy
```

### Step 4: Verify Setup
```bash
# Build the project to check for TypeScript errors
npm run build
```

## Common Issues

### Issue: "Module '@prisma/client' has no exported member 'AddressType'"
**Solution:** Run `npx prisma generate` to regenerate the Prisma client with latest schema.

### Issue: "Property 'sessionId' does not exist on type 'Cart'"
**Solution:** 
1. Make sure migrations are applied: `npx prisma migrate deploy`
2. Regenerate Prisma client: `npx prisma generate`
3. Restart TypeScript server in your IDE

### Issue: "Property 'address' does not exist on type 'PrismaClient'"
**Solution:** The Prisma client needs to be regenerated. Run `npx prisma generate`.

## Full Setup Checklist

- [ ] Clone repository
- [ ] Install dependencies: `npm install`
- [ ] Copy `.env` file and configure database connection
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Build project: `npm run build`
- [ ] Start dev server: `npm run start:dev`

## Environment Variables Required

Make sure your `.env` file has:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
```

## Notes

- Always run `npx prisma generate` after pulling code changes that modify `prisma/schema.prisma`
- If TypeScript errors persist, try deleting `node_modules/.prisma` folder and regenerating
- Make sure your database is running and accessible before running migrations
