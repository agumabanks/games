# Matatu Online Games

This repository hosts the **Matatu Online** card game server and simple web client. The project uses Node.js and MongoDB with optional Docker support.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install
   ```

2. **Configure environment variables**
   Edit the `.env` file in the repository root and provide values for the variables listed there. Important variables include:
   - `NODE_ENV` – `development` or `production`
   - `PORT` – port for the Express server (default `5000`)
   - `MONGO_URI` – MongoDB connection string
   - `REDIS_URI` – Redis connection string (optional)
   - `JWT_SECRET` – secret key for signing JSON Web Tokens
   - `SESSION_SECRET` – session secret used by the server
   - `EMAIL_USER` / `EMAIL_PASS` – credentials for sending email
   - `CLIENT_URL` – base URL for the front‑end

   Additional variables such as `SOKO24_API_KEY`, `UPLOAD_DIR`, `BCRYPT_ROUNDS` and others are also available in the `.env` file.

## Running the Server

To start the development server with automatic reloads:

```bash
cd backend
npm run dev
```

For a production build simply run `npm start` inside the `backend` directory. A `docker-compose.yml` file is also provided for running MongoDB, Redis and the Node.js server using Docker:

```bash
docker-compose up --build
```

## Running Tests

Jest tests live in the `tests` folder at the repository root. Run them with:

```bash
npm test
```

The test suite uses an in-memory MongoDB instance so no database setup is required.

