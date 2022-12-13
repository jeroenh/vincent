# VINCE-NT User Roles

The following documentation describes each user role and general permissions
and responsibilities available to the role.


## User Roles

1. Superuser (Administrator)

   * Description:  Has full control over the application,
   including user management, system configuration, and data administration.

   * Permissions:
     - Manage user accounts, roles, and permissions
     - Configure system settings and preferences
     - Access the admin panel and modify all data

   * The superuser role is a flag on the user object.  Only a superuser
   can grant superuser to a user.  This is done in the admin panel by checking the
   "superuser status" checkbox under Permissions.
   
2. Analyst

   * Description: Has access to the SSVC app in the application. Has the ability
   to "score" or "analyze" CVEs that are assigned to them.

   * Permissions:
     - Access the SSVC scoring app.
     - Access the SSVC insights page.
     - Can view stats on total assessed/analyzed.
     - Can view own stats on assessed/analysed.
     - Can assess and analyze CVE's assigned to them.
     - Can view anonymized assessments and analysis performed by other analysts.
     - Can lookup CPEs and create new CPEs.

   * The role is granted to a user in the admin panel by adding a user to the "analyst"
   group.

3. Analyst Manager

   * Description: Has access to the SSVC app in the application.  Has the ability
   to score or analyze any CVE in the queue. Has the ability to modify settings
   related to the SSVC app.

   * Permissions:
     - Access the SSVC scoring app.
     - Access the SSVC insights	page.
     - Can view	stats on total assessed/analyzed.
     - Can view	individual user stats on assessed/analysed.
     - Can (re-)assess and (re-)analyze any CVE in the queue
     - Can view	assessments and analysis performed by other analysts
       and view any activity associated with the CVE.
     - Can lookup CPEs and create new CPEs.
     - Can access the settings page and modify any related setting.
     - Can access the User Admin page and adjust auto-assignment settings.

   * The role is granted to a user in the admin panel by adding	a user to the "analyst_mgr"
   group.

4. Coordinator

   * Description: Performs CVD coordinator tasks within the application.

   * Permissions:
     - Can view all CVD cases within the application (read-only)
     - Can assign oneself to a CVD case
     - Can edit CVD cases assigned to them
     - Can create new vendor groups
     - Can add users to vendor groups
     - Can access Triage view (unassigned cases)
     - Can view all components
     - Can view coordinator inbox
     - Can direct message any user/group within the system

   * The role is granted to a user in the admin panel by adding a user to the "coordinator_mgr"
   group.

5. Coordinator Manager

   * Description: Performs CVD coordinator tasks and oversees all CVD tasks within the application.

   * Permissions:
     - Can view/edit all CVD cases within the application
     - Can assign oneself to a CVD case
     - Can edit	any CVD case
     - Can create new vendor groups
     - Can add users to	vendor groups
     - Can access Triage view (unassigned cases)
     - Can view	all components
     - Can view	coordinator inbox
     - Can direct message any user/group within	the system
     - Can edit System settings to configure case settings and tags
     - Can access the User Admin page and adjust auto-assignment settings.
     - Can edit and create new vulnerability reporting forms.
     - (Future): Has ability to view assignment reports on CVD coordinators/tasks.

   * The role is granted to a user in the admin panel by adding a user to the "coordinator_mgr"
   group.

6. User Admin

   * Description: Has the ability to adjust roles 2-6 for any user account other than their own.

   * Permissions:
     - Manage user accounts, roles, and permissions
     - Access the admin panel to manage user accounts
     - Access to the User Admin page to adjust auto-assignment settings.


   * The role is granted to a user in the admin panel by adding a user to the "user_admin"
   group.  The user must also be granted "Staff Status" to login to the admin panel.

