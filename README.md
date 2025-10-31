# Kithul Flow Ops

Production management system for kithul products (Sap → Treacle → Jaggery), covering field collection to final labeling.

## Stack

- Client: React (Vite) + TypeScript + Tailwind + shadcn/ui
- Server: Node.js (Express) + TypeScript
- Database: PostgreSQL
- Auth/Validation: JWT + Zod

## Prerequisites

- Node.js 18+
- npm 8+
- PostgreSQL 13+

## Setup

1. Install dependencies
   ```bash
   # client
   cd client && npm install

   # server
   cd ../server && npm install
   ```

2. Database and schema
   ```bash
   createdb kithul_flow_ops
   psql -d kithul_flow_ops -f db/full_schema.sql
   ```

3. Environment (server/.env)
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/kithul_flow_ops
   JWT_SECRET=change-me
   CLIENT_ORIGIN=http://localhost:5173
   PORT=5000
   ```

## Run

- Backend
  ```bash
  cd server && npm run dev
  ```

- Frontend
  ```bash
  cd client && npm run dev
  ```

- URLs
  - App: http://localhost:5173
  - API: http://localhost:5000

## Structure

```
kithul-flow-ops/
├── client/   # React app
├── server/   # Express API
├── db/       # SQL schema
└── README.md
```

## License

MIT
# 🌿 Kithul Flow Ops

> **Enterprise Production Management System for Kithul (Coconut Palm) Products**

A comprehensive full-stack web application designed to streamline and manage the complete production workflow of kithul products (Sap → Treacle → Jaggery), from field collection to final packaging and labeling.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

---

## TL;DR

- **What it is**: A role-based production ops platform for kithul products covering Field Collection → Processing → Packaging → Labeling, plus Admin.
- **Why it matters**: Improves traceability, quality, and throughput with clean UI, reports, and strong data integrity.
- **Tech**: React + Vite + Tailwind + shadcn/ui. Node/Express + PostgreSQL. TypeScript end-to-end.

### Quick start

```bash
# Backend API
cd server && npm install && npm run dev

# Frontend (Vite)
cd client && npm install && npm run dev
```

- Configure server `.env` (DATABASE_URL, JWT_SECRET, CLIENT_ORIGIN, PORT)
- Set client `VITE_API_URL` to the server origin if needed

### Core modules

- **Field Collection**: Drafts, cans, quality metrics
- **Processing**: Batches, submission, reopen, reports
- **Packaging**: Costs, materials, finished quantities
- **Labeling**: Final checks, labeling, analysis
- **Admin**: Users, centers, monitoring, CSV/PDF

> Full documentation continues below.

<details>
<summary><strong>Full documentation</strong></summary>
<br/>

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [User Roles & Permissions](#-user-roles--permissions)
- [Database Schema](#-database-schema)
- [Development](#-development)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🌟 Overview

Kithul Flow Ops is a modern, enterprise-grade production management system specifically designed for the kithul industry. The system manages a complete 4-stage production pipeline with two distinct product flows: **Sap → Treacle (in-house)** and **Treacle (third-party) → Jaggery**, ensuring quality control, traceability, and efficient workflow management from raw material collection to final product labeling.

### Key Benefits

- **🔄 Streamlined Workflow**: Complete 4-stage production pipeline management
- **👥 Role-Based Access**: Secure multi-user system with role-specific permissions
- **📊 Real-Time Tracking**: Live monitoring of production batches and quality metrics
- **📱 Mobile-Responsive**: Optimized for field workers and office staff
- **🔒 Enterprise Security**: JWT authentication with comprehensive data validation
- **📈 Scalable Architecture**: Built to handle growing production volumes

## ✨ Features

### 🏭 Production Pipeline Management

- **Field Collection**: Daily collection drafts with quality metrics tracking
- **Processing**: Batch processing with gas usage and output monitoring
- **Packaging**: Cost tracking and finished quantity management
- **Labeling**: Final stage with comprehensive cost analysis

### 📊 Quality Control & Monitoring

- **Brix Value Tracking**: Sugar content measurement (0-100%)
- **pH Level Monitoring**: Acidity tracking (0-14 scale)
- **Quantity Management**: Precise volume and weight tracking
- **Batch Traceability**: Complete audit trail from collection to packaging

### 👤 User Management

- **Multi-Role System**: Administrator, Field Collection, Processing, Packaging, Labeling
- **Profile Management**: User profiles with image uploads
- **Permission Control**: Role-based access to system features
- **Activity Tracking**: User action logging and audit trails

### 📈 Reporting & Analytics

- **Production Reports**: Daily, weekly, and monthly production summaries
- **Cost Analysis**: Detailed cost tracking across all production stages
- **Quality Metrics**: Brix and pH trend analysis
- **Export Functionality**: Excel export for external analysis

## 🏗️ Architecture

The system follows a modern, scalable architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React SPA)   │◄──►│   (Express.js)  │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │                 │
│ • TypeScript    │    │ • RESTful API   │    │ • Normalized    │
│ • React Query   │    │ • JWT Auth      │    │ • ACID Compliant│
│ • Tailwind CSS  │    │ • Zod Validation│    │ • Triggers      │
│ • shadcn/ui     │    │ • Role-based RBAC│   │ • Constraints   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Professional component library
- **React Query** - Server state management
- **React Router** - Client-side routing

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe server development
- **PostgreSQL** - Relational database
- **JWT** - Authentication and authorization
- **bcrypt** - Password hashing
- **Zod** - Schema validation
- **Multer** - File upload handling

### DevOps & Tools
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - API protection
- **ESLint** - Code linting
- **Prettier** - Code formatting

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **PostgreSQL** (v13 or higher)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/kithul-flow-ops.git
   cd kithul-flow-ops
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install client dependencies
   cd client && npm install
   
   # Install server dependencies
   cd ../server && npm install
   ```

3. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb kithul_flow_ops
   
   # Run database schema
   psql -d kithul_flow_ops -f db/full_schema.sql
   
   # Seed sample data (optional)
   psql -d kithul_flow_ops -f db/sample_data.sql
   ```

4. **Configure environment variables**
   ```bash
   # Create server/.env file
   cp server/.env.example server/.env
   
   # Edit server/.env with your configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/kithul_flow_ops
   JWT_SECRET=your-super-secret-jwt-key
   CLIENT_ORIGIN=http://localhost:5173
   PORT=5000
   ```

5. **Start the development servers**
   ```bash
   # Terminal 1: Start backend server
   cd server && npm run dev
   
   # Terminal 2: Start frontend development server
   cd client && npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000

### Default Login Credentials

| Role               | User ID     | Password     |
| ------------------ | ----------- | ------------ |
| Administrator      | `admin01`   | `Admin#123`  |
| Field Collection   | `field01`   | `Field#123`  |
| Processing         | `process01` | `Process#123` |
| Packaging          | `package01` | `Package#123` |
| Labeling           | `label01`   | `Label#123`  |

## 📁 Project Structure

```
kithul-flow-ops/
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── lib/            # Utilities and services
│   │   ├── hooks/          # Custom React hooks
│   │   └── main.tsx        # Application entry point
│   ├── public/             # Static assets
│   └── package.json
├── server/                 # Express.js backend
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── db.ts           # Database connection
│   │   └── index.ts        # Server entry point
│   ├── uploads/            # File upload directory
│   └── package.json
├── db/                     # Database schema and migrations
│   ├── full_schema.sql     # Complete database schema
│   ├── sample_data.sql     # Sample data for development
│   └── *.sql              # Individual module schemas
└── README.md
```

## 🔌 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User authentication
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/logout` - User logout

### Field Collection API
- `GET /api/field-collection/drafts` - List collection drafts
- `POST /api/field-collection/drafts` - Create new draft
- `GET /api/field-collection/drafts/:id` - Get draft details
- `PUT /api/field-collection/drafts/:id` - Update draft
- `DELETE /api/field-collection/drafts/:id` - Delete draft

### Processing API
- `GET /api/processing/cans` - List available cans for processing
- `GET /api/processing/batches` - List processing batches
- `POST /api/processing/batches` - Create processing batch
- `GET /api/processing/batches/:id` - Get batch details
- `PATCH /api/processing/batches/:id` - Update batch
- `PUT /api/processing/batches/:id/cans` - Assign cans to batch
- `POST /api/processing/batches/:id/submit` - Submit batch
- `POST /api/processing/batches/:id/reopen` - Reopen batch
- `DELETE /api/processing/batches/:id` - Delete batch

### Admin API
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create new user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

## 👥 User Roles & Permissions

### Administrator
- **Full System Access**: All features and data
- **User Management**: Create, update, delete users
- **System Configuration**: Manage collection centers
- **Reports**: Access to all reporting features

### Field Collection
- **Draft Management**: Create and manage collection drafts
- **Can Entry**: Record product quality metrics
- **Center Management**: Submit center completions
- **Limited Reports**: Field collection specific reports

### Processing
- **Batch Management**: Create and manage processing batches
- **Can Assignment**: Assign cans to processing batches
- **Quality Tracking**: Monitor processing metrics
- **Processing Reports**: Batch and efficiency reports

### Packaging
- **Packaging Batches**: Create from completed processing
- **Cost Tracking**: Record packaging material costs
- **Quantity Management**: Track finished quantities
- **Packaging Reports**: Cost and efficiency analysis

### Labeling
- **Labeling Batches**: Create from completed packaging
- **Label Cost Tracking**: Record labeling material costs
- **Final Quality Check**: Complete production workflow
- **Labeling Reports**: Final stage cost analysis

## 🗄️ Database Schema

The database uses a **product-separated approach** with comprehensive normalization. **Total: 14 tables**

### Core Tables (4)
- `users` - User accounts and authentication
- `collection_centers` - Physical collection locations
- `field_collection_drafts` - Daily collection drafts (shared across products)
- `field_collection_center_completions` - Completion tracking for centers within drafts

### Field Collection Tables (2)
- `sap_cans` - Raw SAP containers collected from field centers (product_type: 'sap')
- `treacle_cans` - Third-party Treacle containers purchased from field centers (product_type: 'treacle')

### Processing Tables (4)
- `treacle_processing_batches` - Batches that process SAP → Treacle (in-house, product_type: 'treacle')
- `jaggery_processing_batches` - Batches that process Treacle → Jaggery (product_type: 'jaggery')
- `treacle_processing_batch_cans` - Junction table linking SAP cans to processing batches (max 15 cans per batch)
- `jaggery_processing_batch_cans` - Junction table linking Treacle cans to processing batches (max 15 cans per batch)

### Packaging Tables (2)
- `treacle_packaging_batches` - Packages in-house Treacle from `treacle_processing_batches` (1:1 relationship)
- `jaggery_packaging_batches` - Packages Jaggery from `jaggery_processing_batches` (1:1 relationship)

### Labeling Tables (2)
- `treacle_labeling_batches` - Labels in-house Treacle from `treacle_packaging_batches` (1:1 relationship)
- `jaggery_labeling_batches` - Labels Jaggery from `jaggery_packaging_batches` (1:1 relationship)

### Key Features
- **Referential Integrity**: Foreign key constraints ensure data consistency
- **Business Rules**: Database triggers enforce 15-can limit per processing batch
- **Audit Trails**: Comprehensive timestamp tracking (`created_at`, `updated_at`)
- **Data Validation**: Check constraints for product types and status values
- **Unique Constraints**: One-to-one relationships between processing→packaging→labeling stages

## 🛠️ Development

### Available Scripts

**Client (Frontend)**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

**Server (Backend)**
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run seed:admin   # Seed admin users
npm run seed:centers # Seed collection centers
```

### Code Quality

- **TypeScript**: Strict type checking enabled
- **ESLint**: Configured for React and Node.js
- **Prettier**: Consistent code formatting
- **Git Hooks**: Pre-commit validation (recommended)

### Testing

```bash
# Run tests (when implemented)
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 🚀 Deployment

### Production Build

```bash
# Build client
cd client && npm run build

# Build server
cd server && npm run build
```

### Environment Variables

**Required for Production:**
```env
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-production-jwt-secret
CLIENT_ORIGIN=https://your-domain.com
PORT=5000
NODE_ENV=production
```

### Docker Deployment (Recommended)

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

### Database Migration

```bash
# Run database migrations
psql -d kithul_flow_ops -f db/full_schema.sql

# Seed production data
psql -d kithul_flow_ops -f db/sample_data.sql
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Follow the existing code style

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:

- **Documentation**: Check this README and inline code comments
- **Issues**: Create an issue on GitHub
- **Email**: support@kithulflowops.com

---

**Built with ❤️ for the Kithul Industry**

*Streamlining production workflows, one batch at a time.*

<details>
## 👥 User Roles & Permissions

### Administrator
- **Full System Access**: All features and data
- **User Management**: Create, update, delete users
- **System Configuration**: Manage collection centers
- **Reports**: Access to all reporting features

### Field Collection
- **Draft Management**: Create and manage collection drafts
- **Can Entry**: Record product quality metrics
- **Center Management**: Submit center completions
- **Limited Reports**: Field collection specific reports

### Processing
- **Batch Management**: Create and manage processing batches
- **Can Assignment**: Assign cans to processing batches
- **Quality Tracking**: Monitor processing metrics
- **Processing Reports**: Batch and efficiency reports

### Packaging
- **Packaging Batches**: Create from completed processing
- **Cost Tracking**: Record packaging material costs
- **Quantity Management**: Track finished quantities
- **Packaging Reports**: Cost and efficiency analysis

### Labeling
- **Labeling Batches**: Create from completed packaging
- **Label Cost Tracking**: Record labeling material costs
- **Final Quality Check**: Complete production workflow
- **Labeling Reports**: Final stage cost analysis

## 🗄️ Database Schema

The database uses a **product-separated approach** with comprehensive normalization. **Total: 14 tables**

### Core Tables (4)
- `users` - User accounts and authentication
- `collection_centers` - Physical collection locations
- `field_collection_drafts` - Daily collection drafts (shared across products)
- `field_collection_center_completions` - Completion tracking for centers within drafts

### Field Collection Tables (2)
- `sap_cans` - Raw SAP containers collected from field centers (product_type: 'sap')
- `treacle_cans` - Third-party Treacle containers purchased from field centers (product_type: 'treacle')

### Processing Tables (4)
- `treacle_processing_batches` - Batches that process SAP → Treacle (in-house, product_type: 'treacle')
- `jaggery_processing_batches` - Batches that process Treacle → Jaggery (product_type: 'jaggery')
- `treacle_processing_batch_cans` - Junction table linking SAP cans to processing batches (max 15 cans per batch)
- `jaggery_processing_batch_cans` - Junction table linking Treacle cans to processing batches (max 15 cans per batch)

### Packaging Tables (2)
- `treacle_packaging_batches` - Packages in-house Treacle from `treacle_processing_batches` (1:1 relationship)
- `jaggery_packaging_batches` - Packages Jaggery from `jaggery_processing_batches` (1:1 relationship)

### Labeling Tables (2)
- `treacle_labeling_batches` - Labels in-house Treacle from `treacle_packaging_batches` (1:1 relationship)
- `jaggery_labeling_batches` - Labels Jaggery from `jaggery_packaging_batches` (1:1 relationship)

### Key Features
- **Referential Integrity**: Foreign key constraints ensure data consistency
- **Business Rules**: Database triggers enforce 15-can limit per processing batch
- **Audit Trails**: Comprehensive timestamp tracking (`created_at`, `updated_at`)
- **Data Validation**: Check constraints for product types and status values
- **Unique Constraints**: One-to-one relationships between processing→packaging→labeling stages

## 🛠️ Development

### Available Scripts

**Client (Frontend)**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

**Server (Backend)**
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run seed:admin   # Seed admin users
npm run seed:centers # Seed collection centers
```

### Code Quality

- **TypeScript**: Strict type checking enabled
- **ESLint**: Configured for React and Node.js
- **Prettier**: Consistent code formatting
- **Git Hooks**: Pre-commit validation (recommended)

### Testing

```bash
# Run tests (when implemented)
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 🚀 Deployment

### Production Build

```bash
# Build client
cd client && npm run build

# Build server
cd server && npm run build
```

### Environment Variables

**Required for Production:**
```env
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-production-jwt-secret
CLIENT_ORIGIN=https://your-domain.com
PORT=5000
NODE_ENV=production
```

### Docker Deployment (Recommended)

```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

### Database Migration

```bash
# Run database migrations
psql -d kithul_flow_ops -f db/full_schema.sql

# Seed production data
psql -d kithul_flow_ops -f db/sample_data.sql
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit your changes**: `git commit -m 'Add amazing feature'`
4. **Push to the branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Follow the existing code style

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:

- **Documentation**: Check this README and inline code comments
- **Issues**: Create an issue on GitHub
- **Email**: support@kithulflowops.com

</details>