# **App Name**: Portal Lumen

## Core Features:

- Secure User Authentication (Name + PIN): Allows employees to log in securely using their name and a 4-digit PIN. The system validates credentials, checks user status, and records login attempts, including failures, in audit logs.
- Personalized Employee Dashboard: Provides each employee with a personalized homepage displaying their current day's work status (Office, Home Office, Closed, etc.), upcoming workweek overview, and quick links to submit requests.
- Comprehensive Weekly Schedule View: Displays the employee's full week (Monday-Sunday) with dynamically calculated work statuses for each day, considering company 'week alternating' rules, holidays, office closures, and approved personal requests.
- Employee Request Submission & Tracking: Enables employees to submit requests for vacations, permissions, or report sick leave. Users can view their current vacation balance and track the status of their submitted requests.
- HR Admin User & System Management: Offers a dedicated administrative panel for HR to manage employee profiles (create, read, update, deactivate), adjust vacation balances, and configure global system settings such as 'week1_monday_date', holidays, and office closures.
- HR Admin Request Approval Workflow: Allows HR administrators to review, approve, or reject pending employee requests. For approved vacation requests, the system automatically and atomically deducts the appropriate number of days from the employee's vacation balance.
- Audit Logging & Diagnostic Tools: Automatically records significant system actions for accountability and troubleshooting. An administrative diagnostic panel provides tools to verify database connectivity and basic system functionality, including the option to create demo data.

## Style Guidelines:

- Primary color: A modern, serene cyan (#3492B2), symbolizing clarity and professionalism. It offers a calm, refreshing feel for an internal tool.
- Background color: An extremely light, cool off-white (#F0F4F5), derived from the primary hue but heavily desaturated, ensuring a clean and unobtrusive canvas for content.
- Accent color: A vibrant yet harmonious turquoise (#52E0BD), providing visual contrast for call-to-action buttons and interactive elements, analogous to the primary color.
- Body and headline font: 'Inter' (sans-serif), chosen for its modern, highly readable, and screen-optimized characteristics, suitable for conveying information clearly across various text densities.
- Use a consistent set of clear, line-based icons for navigation, actions, and status indicators. Icons should be easily discernible and contribute to intuitive usability within a mobile-first approach.
- Embrace a mobile-first, minimalist design with ample white space, clear information hierarchy, and responsive components. Prioritize large, easily tappable buttons and concise forms to optimize user interaction.
- Incorporate subtle, functional animations for user feedback, such as confirmation on form submissions, loading indicators, and smooth transitions between views. Avoid superfluous animations to maintain a focus on efficiency.