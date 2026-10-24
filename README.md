# FileGuard

**A Secure File Integrity and Authenticity Verification System Using SHA-256**

Mini Project (20MCA 245), S3 MCA, Vidya Academy of Science & Technology
Author: Amaldev K G

FileGuard shows whether a file has been changed and whether its reference copy can be trusted. A user submits a file, an admin approves it, and the approved file becomes the trusted original. Any copy can then be checked against it later.

## How it works

1. **Submit (user):** the file's SHA-256 hash is computed and the file is saved as *Pending*. It is not signed yet and cannot be verified.
2. **Approve (admin):** the admin reviews the file. Approval re-checks the stored file's hash, signs it with an RSA-2048 private key (PSS padding) and makes it the trusted original. The admin can set an optional expiry date. The admin can also reject a file with a reason.
3. **Verify (user):** the uploaded file is hashed again and compared with the approved hash, the signature is checked with the public key, and then the expiry date is checked.

### Verification results

| Result | Meaning |
|---|---|
| Verified | Hash matches, signature is valid and the approval has not expired |
| Tampered | The hash differs from the approved original |
| Expired | The file is genuine, but the admin's approval date has passed |
| Not Registered | No approved file with this name (pending, rejected or unknown) |

## Features

- Sign up, login and logout with token authentication; users only see their own files
- Two roles: normal user and admin. The admin cannot submit or verify files, so nobody approves their own file
- Admin control panel: approve or reject requests, tamper alerts, statistics, activate or deactivate users
- Approval expiry: optional expiry date, *Set expiry*, *Expire now*
- Extension requests: the user asks for an extension on an expired approval, and the admin extends or declines it
- Dashboard with file status, validity and full verification history
- PDF verification report for every check (reportlab)
- File download and delete (the verification history is kept)

## Technology

Python, Django, Django REST Framework, django-cors-headers, cryptography, hashlib, reportlab, React, Vite, SQLite

## Project structure

```
FileGuard/
  backend/    Django REST API (core app: models, views, crypto, report)
  frontend/   React + Vite user interface
```

## Run it locally

You need Python 3 and Node.js.

### 1. Backend

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

The `createsuperuser` account is the **admin** account. The RSA key pair is created automatically the first time it is needed and is kept in `backend/keys/` (this folder is not uploaded to GitHub).

### 2. Frontend

Open a second terminal:

```
cd frontend
npm install
npm run dev
```

Open the address shown by Vite (usually http://localhost:5173). The backend runs on http://127.0.0.1:8000.

### 3. Try it

1. Sign up a normal user and submit a file on the **Register** tab.
2. Log in as the admin and **Approve** it (optionally choose an expiry date).
3. Log in as the user and **Verify** the same file: Verified.
4. Change one character in the file and verify again: Tampered.

## Tests

```
cd backend
python manage.py test core
```

The backend has 33 automated tests covering permissions, approval and rejection, signing, tamper detection, user isolation, download and delete, reports, admin statistics, expiry and extension requests.

## Limitations

- Verification matches by file name, so a renamed copy is reported Not Registered
- One system-wide RSA key pair, stored as PEM files on the server
- Expiry is in whole days (end of the chosen day, server time)
- Runs locally on SQLite; no HTTPS or hosting set-up
- Login tokens do not expire; no email notifications