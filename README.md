# Local Heritage & Tourism Guide

Local Heritage is a lightweight web application designed to connect travelers with local Kenyan artisans, cultural workshops, and community-based tourist destinations. The platform enables visitors to discover cultural sites, review artisan experiences, and book visits with direct communication channels. https://maithamweni2005-ux.github.io/LOCAL-HERITAGE/

---

## Features

### Authentication & Roles
- Role-based registration for Customers and Artisans.
- Minimalist login and registration interface powered by Supabase Auth.
- Role-based routing to custom dashboards or admin views.

### Customer Dashboard
- **Direct Sites Feed**: Instant access to cultural and eco-tourism sites without unnecessary landing page clutter.
- **Reviews & Ratings**: View aggregate review counts, read community reviews in dedicated modal views, and submit verified feedback.
- **Interactive Map**: In-platform Google Map viewer centered on Kenya to browse site locations.
- **Booking & Checkout**: Calculate entrance fees based on group size and confirm bookings.
- **Direct Messaging**: Automatic chat bridge connecting visitors directly to host artisans upon booking.

### Artisan Dashboard
- Full listing control to publish, edit, and delete tourist sites.
- Review tracking for workshop feedback and site reputation.
- Prepared fields for future media and image storage integration.

### Admin Console
- **User Management**: View, filter, message, or remove customer and artisan accounts.
- **Site Moderation**: Full administrative control to inspect, update, or remove listed destinations.
- **Security Tools**: Dispatch password reset instructions directly to registered emails.
- **Bookings Oversight**: Monitor visitor reservations, payment totals, and update status (Confirmed, Completed, Cancelled).
- **Analytics**: Key platform metrics covering user totals, revenue, and top-rated artisans.

---

## Tech Stack

- **Frontend**: Semantic HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Icons**: Lucide Icons (CDN)
- **Backend / Database**: Supabase (PostgreSQL, Auth, Row Level Security, Realtime)
- **Mapping**: Google Maps Embed API

---

## Project Structure

```text
.
├── index.html         # Authentication portal (Sign In / Register)
├── styles.css         # Stylesheet for authentication views
├── app.js             # Core Supabase client setup and authentication logic
├── dashboard.html     # User and Artisan dashboard interface
├── dashboard.css      # Dashboard styling and responsive layout
├── dashboard.js       # Feed, reviews, booking, chat, and profile handling
├── admin.html         # Administrator dashboard
├── admin.css          # Admin panel layout and table styling
├── admin.js           # Administrative management logic and analytics
└── README.md          # Project documentation
