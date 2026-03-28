# Order Processing & Live Status System

This project is a scalable, real-time backend API for an order management system. It supports role-based access control (Buyer, Seller, Admin), queue-based background processing for automated order lifecycle changes and stock updates, and live status tracking using WebSockets.

## 🚀 Tech Stack

- **Platform:** Node.js, Express
- **Language:** TypeScript
- **Database:** MongoDB (via Mongoose)
- **Caching & Queues:** Redis, BullMQ
- **Real-Time events:** Socket.io
- **Security:** JWT Authentication, Role-Based Access Control

## 📂 Project Structure

```text
src/
├── config/           # Centralized configuration (Env vars, DB Connect, Redis setup)
├── controllers/      # Route handlers separated by domain (Auth, Product, Order)
├── interfaces/       # Global TypeScript types and interfaces
├── middlewares/      # Express middlewares (Authentication, Schema Validation, RBAC)
├── models/           # Mongoose schemas for DB structure
├── queues/           # BullMQ producers
├── routes/           # Express routers defining API endpoints
├── services/         # Core business logic separate from controllers
├── sockets/          # Socket.io connection logic, rooms, and event emitters
├── utils/            # Shared helper functions (logger, custom errors, etc.)
└── workers/          # BullMQ consumers (order status transition, stock deduction)
```

## 🛠 Features Breakdown

### Core Services
- **Authentication:** JWT-based login/registration with secure token handling.
- **Product Management:** Complete Seller capabilities for catalog organization and dynamic stock allocation.
- **Order Processing Lifecycle:** Background workflows transition order states (`placed → confirmed → preparing → out_for_delivery → delivered`) asynchronously.
- **Real-Time Tacking:** Buyers, sellers, and admins utilize WebSockets for seamless live updates across specialized rooms (`user:{id}`, `seller:{id}`, `admin`).
- **Caching Strategy:** Intelligent Redis caching limits DB overhead for fast product and order data retrieval.

### Bonus Features Included
- **Webhooks:** For external system notifications (`src/services/webhooks`)
- **Seller Analytics:** Enhanced dashboard tracking implementation (`src/services/analytics`)
- **Category Support:** Advanced item categorization (`src/services/categories`)
- **Order Rating System:** Post-delivery review capabilities (`src/services/ratings`)
- **Stock Updates Queue:** Dedicated BullMQ worker for async stock manipulation without blocking the main event loops (`src/workers/stock-update`)

## ⚙️ Getting Started

Follow these instructions to start the project locally.

### Prerequisites

Ensure you have the following installed locally:
- [Node.js](https://nodejs.org/) (v16+)
- [MongoDB](https://www.mongodb.com/docs/manual/installation/) or a remote MongoDB Atlas URI
- [Redis](https://redis.io/docs/getting-started/) (A running Redis instance required for queues and caching)

### 1. Install Dependencies

```bash
# Install core packages and typings
npm install
```

### 2. Configure Environment

Copy the `.env.example` to `.env` and fill in your details:

```bash
cp .env.example .env
```

Ensure `MONGO_URI` and `REDIS_HOST` are pointing to your active services.

### 3. Start Development Server

Run the development command to start the Express and Socket.io server with hot-reload enabled.

```bash
npm run dev
```

### 4. Build for Production

Compile TypeScript locally for production hosting:

```bash
npm run build
npm start
```
