# Authentication API Documentation

## Base URL
All endpoints are prefixed with `/api/auth`

---

## Public Endpoints (No Authentication Required)

### 1. Register User
**POST** `/api/auth/register`

Register a new user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "avatar": null,
    "role": "CUSTOMER",
    "provider": "LOCAL",
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `409 Conflict`: Email already registered
- `400 Bad Request`: Validation errors

---

### 2. Login
**POST** `/api/auth/login`

Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "avatar": null,
    "role": "CUSTOMER",
    "provider": "LOCAL",
    "emailVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `400 Bad Request`: Validation errors

---

### 3. Google OAuth - Initiate
**GET** `/api/auth/google`

Initiates Google OAuth flow. Redirects user to Google login page.

**Response:** Redirects to Google OAuth consent screen

---

### 4. Google OAuth - Callback
**GET** `/api/auth/google/callback`

OAuth callback endpoint (handled automatically by Google).

**Response:** Redirects to frontend with token:
```
http://your-frontend.com/auth/callback?token=JWT_TOKEN&user=USER_DATA
```

---

### 5. Facebook OAuth - Initiate
**GET** `/api/auth/facebook`

Initiates Facebook OAuth flow. Redirects user to Facebook login page.

**Response:** Redirects to Facebook OAuth consent screen

---

### 6. Facebook OAuth - Callback
**GET** `/api/auth/facebook/callback`

OAuth callback endpoint (handled automatically by Facebook).

**Response:** Redirects to frontend with token:
```
http://your-frontend.com/auth/callback?token=JWT_TOKEN&user=USER_DATA
```

---

### 7. Apple OAuth - Initiate
**GET** `/api/auth/apple`

Initiates Apple OAuth flow (requires Apple Developer setup).

**Note:** Apple OAuth requires additional configuration. See `AUTH_ENVIRONMENT_SETUP.md`

---

## Protected Endpoints (Require Authentication)

All protected endpoints require the `Authorization` header:
```
Authorization: Bearer <accessToken>
```

---

### 8. Get Profile
**GET** `/api/auth/profile`

Get current authenticated user's profile.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "avatar": "https://example.com/avatar.jpg",
  "role": "CUSTOMER",
  "provider": "LOCAL",
  "emailVerified": true,
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: User not found

---

### 9. Update Profile
**PUT** `/api/auth/profile`

Update current user's profile information.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "email": "newemail@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+9876543210"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "email": "newemail@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+9876543210",
  "avatar": null,
  "role": "CUSTOMER",
  "provider": "LOCAL",
  "emailVerified": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing token
- `409 Conflict`: Email already in use
- `400 Bad Request`: Validation errors

---

### 10. Change Password
**PUT** `/api/auth/change-password`

Change password (only for LOCAL auth users).

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

**Response (200 OK):**
```json
{
  "message": "Password changed successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid token or incorrect current password
- `400 Bad Request`: User doesn't have a password (OAuth user) or validation errors

---

### 11. Admin Only Endpoint (Example)
**GET** `/api/auth/admin`

Example endpoint that requires ADMIN role.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200 OK):**
```json
{
  "message": "Admin access granted",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid token
- `403 Forbidden`: User doesn't have ADMIN role

---

## Using Authentication in Your Controllers

### Protect a Route

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('products')
export class ProductsController {
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateProductDto) {
    // user.id, user.email, user.role available here
    return this.productsService.create(dto, user.id);
  }
}
```

### Require Admin Role

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('products')
export class ProductsController {
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.productsService.delete(id);
  }
}
```

### Make a Route Public

```typescript
import { Public } from '../auth/decorators/public.decorator';

@Controller('products')
export class ProductsController {
  @Public()
  @Get()
  async findAll() {
    // This route is accessible without authentication
    return this.productsService.findAll();
  }
}
```

---

## Frontend Integration Examples

### Next.js

```typescript
// lib/auth.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Login failed');
  }
  
  const data = await response.json();
  localStorage.setItem('token', data.accessToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export async function register(userData: RegisterData) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }
  
  const data = await response.json();
  localStorage.setItem('token', data.accessToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

// OAuth redirects
export const googleLogin = () => {
  window.location.href = `${API_URL}/auth/google`;
};

export const facebookLogin = () => {
  window.location.href = `${API_URL}/auth/facebook`;
};
```

### Vue.js

```typescript
// services/auth.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  async login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },
  
  async register(userData: RegisterData) {
    const { data } = await api.post('/auth/register', userData);
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },
  
  async getProfile() {
    const { data } = await api.get('/auth/profile');
    return data;
  },
  
  async updateProfile(updates: UpdateProfileData) {
    const { data } = await api.put('/auth/profile', updates);
    return data;
  },
  
  async changePassword(currentPassword: string, newPassword: string) {
    const { data } = await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return data;
  },
  
  googleLogin() {
    window.location.href = `${API_URL}/auth/google`;
  },
  
  facebookLogin() {
    window.location.href = `${API_URL}/auth/facebook`;
  },
  
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};
```

---

## JWT Token Structure

The JWT token contains:
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "CUSTOMER",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Token Expiration:** Default is 7 days (configurable via `JWT_EXPIRES_IN`)

---

## Error Handling

All endpoints return standard HTTP status codes:
- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Validation error or bad request
- `401 Unauthorized`: Authentication required or invalid credentials
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., email already exists)
- `500 Internal Server Error`: Server error

Error response format:
```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```
