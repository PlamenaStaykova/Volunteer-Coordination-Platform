# Volunteer Coordination Platform - Authentication Setup

## Getting Started with Authentication

The platform now includes user registration and login functionality powered by Supabase.

### Prerequisites

1. A Supabase project account (create one at https://supabase.com)
2. Node.js and npm installed

### Setup Instructions

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```

2. **Create a `.env.local` file** in the project root:
   ```bash
   cp .env.example .env.local
   ```

3. **Get your Supabase credentials**:
   - Go to your Supabase project dashboard
   - Navigate to **Settings > API**
   - Copy your **Project URL** (VITE_SUPABASE_URL)
   - Copy your **anon public key** (VITE_SUPABASE_ANON_KEY)

4. **Update `.env.local`** with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

5. **Ensure Supabase Authentication is enabled**:
   - In your Supabase project, go to **Authentication > Providers**
   - Make sure "Email" provider is enabled
   - Configure email settings as needed

6. **Start the development server**:
   ```bash
   npm run dev
   ```

7. **Visit the application**:
   - Open http://localhost:5173
   - Use the unified auth page at `/auth` (single `Log In / Register` flow)
   - In Register tab, choose role: `Organizer` or `Volunteer`

### Features

- **Unified auth**: Single `Log In / Register` page for all users
- **Role selection on register**: Organizer or Volunteer (Admin is not public-registerable)
- **Single login form**: Admin/Organizer/Volunteer all log in from the same form
- **Role-based redirect**: Admin -> Admin dashboard access, Organizer/Volunteer -> role-aware dashboard area
- **Protected Routes**: Redirects unauthenticated users to `/auth`
- **Responsive Design**: Works on desktop, tablet, and mobile devices

### Admin bootstrap (recommended)

Seed an initial admin via environment variables when running `supabase/seed.js`:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_me_secure_password
ADMIN_DISPLAY_NAME=Platform Admin
```

### File Structure

```
src/
├── lib/
│   └── supabase.js          # Supabase client configuration
├── pages/
│   ├── login/
│   │   ├── login.html       # Login page template
│   │   ├── login.js         # Login page logic
│   │   └── login.css        # Login page styles
│   ├── register/
│   │   ├── register.html    # Register page template
│   │   ├── register.js      # Register page logic
│   │   └── register.css     # Register page styles
│   └── ...
├── components/
│   └── header/
│       └── header.js        # Updated with auth state
└── router.js                # Updated with new routes
```

### Troubleshooting

**Pages not loading?**
- Make sure `.env.local` exists and has the correct environment variables
- Check browser console for error messages
- Verify Supabase project URL and key are correct

**Supabase connection errors?**
- Ensure your Supabase project is active
- Check that the anon key is enabled in Supabase settings
- Verify your internet connection

**CORS issues?**
- This is typically handled by Supabase by default
- If issues persist, check your Supabase CORS settings

### Next Steps

After authentication is working:
1. Create user profiles with additional information
2. Implement role-based access control (volunteer, organization, admin)
3. Add profile completion flow after registration
4. Implement password reset functionality
