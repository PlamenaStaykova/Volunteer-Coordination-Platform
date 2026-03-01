# Volunteer Coorination Platform

A platform to connect volunteers with organizations in need of help, allowing volunteers to find and sign up for opportunities to make a positive impact in their communities, built with JS and Supabase.

Users register and create profiles, including their skills and interests. Organizations can post volunteer opportunities, and volunteers can search for and sign up for these opportunities based on their preferences. The platform also includes features for communication between volunteers and organizations, as well as tracking volunteer hours and impact.

## Arcitecture and Tech Stack:

Classical client-server app:
- Frontend: JS, HTML, CSS, Bootstrap for building the user interface and handling user interactions, providing a responsive and visually appealing design.
- Backend: Supabase for database management and authentication, handling data storage and user management.
- Database: Supabase's PostgreSQL database to store user profiles, volunteer opportunities, and other relevant data.
- Authentication: Supabase's built-in authentication system to manage user registration and login.
- Build Tools: Vite and npm for managing dependencies and building the frontend application.
- API: Supabase's RESTful API to facilitate communication between the frontend and backend, allowing for data retrieval and manipulation.
- Hosting: Netlify.
- Source code: GitHub repository for version control and collaboration.

Use modular code structure to separate concerns and improve maintainability, with clear separation between frontend and backend code.

## UI Guide Lines
- Use HTML, CSS, Bootstrap and Vanilla JavaScript for the frontend development.
- Use Bootstrap components and utilities to create a responsive and visually appealing design.
- Implement modern, responsive UI design, with semantic HTML and accessibility best practices.
- Design a clean and intuitive user interface that allows users to easily navigate the platform and find relevant volunteer opportunities.
- Implement responsive design to ensure the platform is accessible on various devices, including desktops, tablets, and smartphones.
- Use consistent styling and color schemes to create a cohesive look and feel throughout the platform.
- Ensure that the platform is accessible to users with disabilities by following web accessibility guidelines, such as providing alternative text for images and ensuring that the platform can be navigated using a keyboard.
- Implement features for communication between volunteers and organizations, such as messaging or email notifications, to facilitate coordination and collaboration.
- Include features for tracking volunteer hours and impact, such as a dashboard that displays the number of hours volunteered and the impact of their contributions, to encourage continued engagement and motivation among volunteers.

## Pages and Navigation
- Split the platform into multiple pages, such as a homepage, volunteer opportunities page, user profile page, admin panel, and organization profile page.
- Implement pages as reusable components to promote code reusability and maintainability (HTML, CSS, JavaScript).
- Use routing to navigate between pages, allowing users to easily access different sections of the platform.
- Use full URLs like /, /opportunities, /profile, /admin, and /organization for navigation to ensure clarity and consistency in the user experience.
- Implement a navigation bar that allows users to easily access different pages and sections of the platform, with clear labels and intuitive design.
- Ensure that the navigation bar is responsive and accessible on various devices, allowing users to easily navigate the platform regardless of their device or screen size.

## Backend and Database Design
- Use Supabase's PostgreSQL database to store user profiles, volunteer opportunities, and other relevant data.  
- Design the database schema to include tables for users, organizations, volunteer opportunities, and volunteer hours, with appropriate relationships between tables to ensure data integrity and efficient querying.
- Use Supabase's RESTful API to facilitate communication between the frontend and backend, allowing for data retrieval and manipulation, such as creating new volunteer opportunities, updating user profiles, and tracking volunteer hours.
- Implement server-side validation and error handling to ensure data integrity and provide a smooth user experience, with clear error messages and feedback for users when they encounter issues or submit invalid data.
- Use Supabase Storage to handle file uploads, such as profile pictures for users and images for volunteer opportunities, ensuring that files are stored securely and efficiently, with appropriate access controls in place to protect user data.
- When changing the DB schema, use Supabase's migration tools to manage database changes and ensure that the database remains consistent and up-to-date with the application's requirements, allowing for smooth deployment and updates to the platform without disrupting existing data or functionality.
- After applying a migration in Supabase, keep a copy of the SQL file in the code.

## Authentication and Authorization
- Implement authentication and authorization using Supabase's built-in authentication system, allowing users to register, log in, and manage their profiles securely.
- Implement RLS (Row Level Security) policies in Supabase to ensure that users can only access and manipulate data that they are authorized to, such as allowing volunteers to view and sign up for opportunities, while restricting access to sensitive information for organizations and administrators.
- Implement user roles with a separate DB - 'user_roles' + enum 'roles' (eg. 'volunteer', 'organization', 'admin') to manage different levels of access and permissions within the platform, allowing for a more granular control over user actions and data access based on their role.
- Ensure that the authentication and authorization system is secure and follows best practices, such as using strong password hashing algorithms, implementing multi-factor authentication, and regularly reviewing and updating security measures to protect user data and prevent unauthorized access to the platform.