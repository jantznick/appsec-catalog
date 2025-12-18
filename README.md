# AppSec Catalog

A simple, web application designed to serve as a central hub for managing a multi tenant app sec program focused on monitoring risk and managing an ever changing inventory of applications.

## Features

- **Application Onboarding Forms** 2 forms, one for general information provided by executive level tech managers including things like application name, what it does, and how important it is. A second more technical form that includes things like SDLC information, SCM repo links, what other applications it interfaces with and any existing security tools in place.
- **Company Management** A full company management system to achieve multi-tenancy with default settings for applications that teams can choose to autofill forms with when onboarding a new application. Admins can assign users to companies giving them the ability to see everything within that company.
- **User Accounts**: A full user registration and login system using both passwords and/or magic codes. Magic codes can be emailed but for now they're just printed out to the console.
- **Admin Dashboard**: A protected admin area to view and manage all companies and their associated applications
- **Company and Application Grading**: Giving admins the ability to grade both applications on features such as:
- Company/application team communication around application and security goals
- Existing security procedures/policies in place
- Data freshness

## Technology Stack

- **Backend**: Node.js, Express.js, 
  - Cookie based sessions built in with express
- **Frontend**: React, Vite and Zustand/React Context for state management
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Deployment**: docker compose 