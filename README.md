# Local Heritage - Tourism Guide Platform

A comprehensive web platform for connecting tourists with local artisans and tourist sites. Features role-based dashboards for customers, artisans, and administrators.

## 📋 Features

- **Authentication System**: Secure login and registration with role-based access
- **Customer Dashboard**: Browse artisans, view tourist sites, leave reviews
- **Artisan Dashboard**: Manage tourist sites, view customer reviews, update profile
- **Admin Panel**: Manage all users, view analytics, monitor sites and reviews
- **Real-time Data**: Powered by Supabase for instant database updates
- **Responsive Design**: Mobile-friendly interface across all devices

## 🚀 Quick Start

### 1. Setup Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL Editor, run the provided SQL schema to create tables
3. Get your Supabase URL and Anon Key from Project Settings > API

### 2. Update Configuration

Open `app.js` and replace the placeholders:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

### 3. Run the Application

- Open `index.html` in a web browser
- Or use a local server (Python: `python -m http.server`, Node: `npx http-server`)

## 📁 File Structure

```
├── index.html              # Login/Registration page
├── dashboard.html          # Customer & Artisan dashboard
├── admin.html              # Admin panel
├── app.js                  # Main app logic & Supabase init
├── dashboard.js            # Dashboard functionality
├── admin.js                # Admin panel functionality
├── styles.css              # Global styles
├── dashboard.css           # Dashboard-specific styles
└── admin.css               # Admin panel styles
```

## 🔐 User Roles

### Customer
- Browse all artisans and their tourist sites
- Leave reviews and ratings for artisans
- View own profile and reviews
- Discover local heritage and tourism spots

### Artisan
- Manage tourist sites (create, edit, delete)
- View customer reviews and ratings
- Update business profile and information
- Track site listings and popularity

### Admin
- View and manage all users
- Manage artisan profiles
- Monitor tourist sites
- Review management
- Analytics dashboard with insights

## 📊 Database Schema Overview

### Users Table
- `user_id` (PK): Unique user identifier
- `first_name`, `last_name`: User name
- `email`: Unique email
- `password_hash`: Secure password
- `phone_number`: Contact info
- `role`: 'customer' | 'artisan' | 'admin'

### Artisans Table
- `artisan_id` (PK): Unique artisan identifier
- `user_id` (FK): Reference to users
- `business_name`: Artisan business name
- `bio`: Business description
- `craft_category`: Type of craft
- `location`: Business location

### Tourist Sites Table
- `site_id` (PK): Unique site identifier
- `artisan_id` (FK): Reference to artisans
- `title`: Site name
- `description`: Site details
- `location`: Site location
- `entry_fee`: Entry fee amount
- `is_active`: Site status

### Reviews Table
- `review_id` (PK): Unique review identifier
- `customer_id` (FK): Reference to customer
- `artisan_id` (FK): Reference to artisan
- `rating`: 1-5 star rating
- `comment`: Review text

## 🎨 Customization

### Colors
Edit CSS variables in `styles.css`:

```css
--primary-color: #6366f1;
--secondary-color: #f59e0b;
--danger-color: #ef4444;
```

### Adding New Features
1. Add database tables in Supabase
2. Update relevant .js file with new functions
3. Update HTML with new UI elements
4. Style with corresponding .css file

## ⚡ Key JavaScript Functions

### Authentication
- `login()`: Authenticate user with email/password
- `register()`: Create new user account
- `logout()`: Sign out current user
- `getCurrentUser()`: Get logged-in user data

### Dashboard
- `loadSites()`: Fetch all tourist sites
- `loadArtisans()`: Fetch all artisans
- `loadReviews()`: Fetch reviews
- `loadProfile()`: Load user profile

### Admin
- `loadAllUsers()`: Fetch all users
- `deleteUser()`: Remove user
- `loadAnalytics()`: Generate analytics

## 🔒 Security Notes

- Passwords are managed by Supabase Authentication
- Enable Row Level Security (RLS) in Supabase for production
- Add authentication checks before accessing admin panel
- Validate all user inputs on the backend

## 🐛 Troubleshooting

### Users can't login
- Check Supabase URL and API key in `app.js`
- Ensure email exists in users table
- Check browser console for errors

### Pages not loading
- Use a local server instead of opening files directly
- Clear browser cache and cookies
- Check for CORS errors in console

### Data not saving
- Verify table names match schema exactly
- Check Supabase table permissions
- Enable appropriate RLS policies

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📝 License

This project is provided as a template. Customize and use as needed.

## 🤝 Support

For issues with:
- **Supabase**: Visit [supabase.com/docs](https://supabase.com/docs)
- **JavaScript**: Check [MDN Web Docs](https://developer.mozilla.org/)
- **CSS**: Reference [CSS-Tricks](https://css-tricks.com/)
