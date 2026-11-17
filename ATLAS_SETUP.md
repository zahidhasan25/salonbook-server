# MongoDB Atlas Setup — Free M0 Cluster

SalonBook server **real MongoDB ছাড়া চলবে না** — `MONGODB_URI` না দিলে
server চালুই হবে না (আগের in-memory/demo database আর নেই)। নিচে free
cluster বানানোর ধাপগুলো দেওয়া হলো।

The SalonBook server **will not run without a real MongoDB** — it refuses
to start if `MONGODB_URI` is unset (there is no in-memory/demo database
anymore). Follow the steps below to create a free cluster.

## English — step by step

1. **Create an Atlas account** — go to https://www.mongodb.com/atlas and
   sign up (Google sign-in works).
2. **Create a free cluster** — *Create* → choose the **M0 Sandbox (Free)**
   tier → pick a cloud provider + region closest to you (e.g. AWS Mumbai /
   Singapore) → cluster name `salonbook` → *Create Cluster*. It takes
   1–3 minutes to provision.
3. **Create a database user** — left menu *Database Access* → *Add New
   Database User* → username `salonbook` (or anything) → *Autogenerate
   Secure Password* (copy it somewhere safe) → *Read and write to any
   database* → *Add User*.
4. **Allow network access** — left menu *Network Access* → *Add IP
   Address* → **Allow Access from Anywhere `0.0.0.0/0`** (needed for
   deployments like Render/Railway; for local-only testing you can add
   your own IP instead) → *Confirm*.
5. **Copy the connection string** — *Database* → your cluster → *Connect*
   → *Drivers* → copy the `mongodb+srv://...` string. Replace
   `<username>` and `<password>` with the database user from step 3, and
   make sure the database name is `salonbook`, e.g.:
   `mongodb+srv://salonbook:<password>@cluster0.xxxxx.mongodb.net/salonbook`
6. **Paste it into `server/.env`**:
   `MONGODB_URI=mongodb+srv://salonbook:<password>@cluster0.xxxxx.mongodb.net/salonbook`
   (never commit `.env`, never paste the real string into a README or chat
   screenshot).
7. **Restart the server and seed**:
   ```bash
   npm run dev    # in one terminal — must print "MongoDB connected"
   npm run seed   # in another terminal — creates admin + demo customer + 8 services
   ```
   If the server prints `MONGODB_URI is not set`, the `.env` file was not
   loaded — check you edited `server/.env`, not `.env.example`.

## বাংলা — ধাপে ধাপে

1. **Atlas account খুলুন** — https://www.mongodb.com/atlas এ গিয়ে sign up
   করুন (Google দিয়ে sign-in করা যায়)।
2. **Free cluster বানান** — *Create* → **M0 Sandbox (Free)** tier বেছে নিন
   → provider + region বেছে নিন (যেমন AWS Mumbai / Singapore) → cluster
   এর নাম `salonbook` → *Create Cluster*। তৈরি হতে ১–৩ মিনিট লাগে।
3. **Database user বানান** — বাম মেনু *Database Access* → *Add New
   Database User* → username `salonbook` → *Autogenerate Secure Password*
   (password টা নিরাপদে কোথাও লিখে রাখুন) → *Read and write to any
   database* → *Add User*।
4. **Network access দিন** — বাম মেনু *Network Access* → *Add IP Address*
   → **Allow Access from Anywhere `0.0.0.0/0`** (Render/Railway এর মতো
   deploy এর জন্য দরকার; শুধু local test করলে নিজের IP দিলেই হবে) →
   *Confirm*।
5. **Connection string কপি করুন** — *Database* → cluster → *Connect* →
   *Drivers* → `mongodb+srv://...` string টা কপি করুন। `<username>` আর
   `<password>` এর জায়গায় ধাপ ৩ এর user/password বসান, আর database এর
   নাম `salonbook` আছে কিনা দেখুন।
6. **`server/.env` ফাইলে বসান**: `MONGODB_URI=mongodb+srv://...` —
   `.env` কখনো commit করবেন না, README বা screenshot এ আসল string
   দেবেন না।
7. **Server restart করে seed করুন**:
   ```bash
   npm run dev    # এক terminal এ — "MongoDB connected" লেখা আসতে হবে
   npm run seed   # আরেক terminal এ — admin + demo customer + 8 service তৈরি হবে
   ```

## Local MongoDB (alternative, no Atlas)

Already running MongoDB 7.0 on your own machine? Just use:
`MONGODB_URI=mongodb://127.0.0.1:27017/salonbook`
