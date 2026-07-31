# LinkFlow + Appwrite Cloud Setup

This project uses Appwrite Cloud for authentication, database, and storage.

## 1. Create an project in Appwrite Cloud

Go to https://cloud.appwrite.io/ and create a new project called `LinkFlow`.

## 2. Get your Project ID

In the project overview, copy the **Project ID**.

## 3. Create an API key

1. Go to **Overview → API Keys**.
2. Click **Create API Key**.
3. Give it a name (e.g. `linkflow-local`).
4. Enable these scopes:
   - `databases.read`
   - `databases.write`
   - `collections.read`
   - `collections.write`
   - `attributes.write`
   - `indexes.write`
   - `buckets.read`
   - `buckets.write`
   - `files.read`
   - `files.write`
5. Copy the API key immediately (it is shown only once).

## 4. Configure environment variables

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Fill in `NEXT_PUBLIC_APPWRITE_PROJECT_ID` and `APPWRITE_API_KEY`.
3. Keep the other defaults unless you want custom bucket/database names.

## 5. Provision the backend

Run the provision script. It creates the database, collections, attributes, indexes and buckets automatically.

```bash
cd frontend
npm run provision
```

## 6. Run the app

```bash
npm run build
npm start
```

## What the script creates

- Database: `linkflow`
- Collections: `users`, `pages`, `links`, `analytics`, `themes`, `social_links`, `qr_codes`, `subscriptions`, `teams`, `notifications`
- Buckets: `avatars`, `banners`, `files`
- Indexes for performance and uniqueness
- Public/private permissions for pages, links, themes and social links

## Notes

- The public profile page (`/u/[username]`) fetches data server-side using `APPWRITE_API_KEY`.
- Analytics views/clicks are recorded via `/api/view` and `/api/click`.
- Without these credentials the app will show errors when trying to read/write data.
