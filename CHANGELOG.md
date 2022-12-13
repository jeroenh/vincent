#Changelog

All notable changes to VINCE-NT will be documented in this file.

## [1.14.0] - 2026-04-14
### Added
-Initial public release of VINCE-NT
-Complex CSAF relationships
-Added name and email to the custom report
-Added format and scenarios to CVSS when publishing CVE
-Ask to populate SSVC on CVE sync
-Add CVSS Calculator Reference to vul if CVSS 4.0 score is present

### Changed
- Multiple dependency upgrades
- Workflow for creating a vulnerability
- VINCE-NT logo is configurable

### Fixed
- Label vulnerability fields as required/required to publish CVE
- Fixed vulnerability table search

## [1.13.0] - 2026-03-11
### Added

- Messages create Tickets
- Remove Group Inboxs
- Add ticket view
- Allow case participant to add a private thread to case

### Changed
- Worker improvements
- Add configurable message titles
- Improved thread searching in a case
- Dependency upgrades

### Fixed
- Other minor bug fixes and improvements

## [1.12.0] - 2026-02-18
### Added

- Allow user to initiate thread creation
- Better support for searching case threads
- Option to have one visible coordinator identity
- Additional role for creating new CVE analyses
- Add CSAF Acknowledgment summary to CSAF settings

### Changed

- 508 Compliance
- Multiple dependency upgrades
- SSVC app table design

### Fixed

- Generate a report ID to prevent duplicate submissions
- Metrics loading improvements
- Numerous minor bug fixes and improvements


## [1.11.0] - 2025-11-07
### Added

- Add Email Bounce Notification Management
- Add vulnerability attributes form to vul dialog.
- Add vulnerability attributes form to SSVC app.
- Add triage documentation
- Add triage calendar
- Add daily email support
- Add support for Cloudflare turnstile for bot detection
- Add participant pulse
- Add vendor statement approval process
- Automate unresponsive vendor in case states
- Add welcome message for new users and association logic

### Changed

- CSAF now includes vulnerabilities without CVE IDs
- Multiple dependency updates: django

### Fixed
- Numerous minor bug fixes and improvements

## [1.10.0] - 2025-07-10

### Added

- Advisory and CVE approval workflow
- Component and Group Tagging
- A new view to show affected products for a single vulnerability
- Vul Attributes Management Interface
- Allow multiple emails for a vendor organization
- Allow user to clone status
- Add CSAF validator
- Add CSAF to HTML preview
- Add 5-minute NOP task for testing worker operation
- Allow user to add participants to a case by group tag
- Add a new "gov" theme

### Changed

- Multiple dependency versions: django, boto3, urllib,
- JSON indentation on CSAF view
- Require a case to be assigned when case is active and vendor has been notified 
- Hardcoded case milestones with case states defined in admin panel
- Warn user of unsaved changes when editing in a dialog

### Fixed

- Maintain tab location on refresh
- Catch unsupported extensions during spdx upload
- Task filter and timeout validation


## [1.9.0] - 2025-05-07

### Added

- Ability to add predisclosure vuls in scoring app
- JSON file upload to create predisclosure vuls
- Case States and automated transitions
- Case metrics page
- Additional tests for predisclosure vuls

### Changed

- Add additional logging of failed attempts
- Log session timeout events
- Log session creation and destruction

### Fixed

- Case Activity query efficiency
- Fix Post activity
- react-router upgrade
- Prevent Django from invalidating API keys
- Status Statement Requirement
- Show CSAF Profiles on initial load

## [1.8.0] - 2025-04-08

### Added

- Vulnerability Attributes
- Post reactions
- Ability to create cases from tickets
- Add email template for case assignment
- Allow groups to be assigned to cases
- Add ability to change case artifacts meta
- Add vers-like format to CSAF output

### Changed

- Replace Quill editor with Slatejs editor
- Replace mozilla bleach with DomPurify to sanitize HTML
- Permission changes
- Lead Coordinator Group has more permissive role.
- CSAF improvements

### Fixed

- Issue where sometimes CVSS/SSVC scores are overwritten
- Fix infinite scroll in the activity modal.
- Show when case participants view case.
- Allow case participants to view status that has been shared.
- Fix case activity search
- Dependency upgrades

## [1.7.0] - 2025-01-19

### Added

- Vulnerability table editor
- Add CSAF case settings
- Add CSAF revision history view
- Add CNA filter to scoring app
- CSAF settings profile
- Case access permissions for group admins
- Defined access control roles and permissions
- CPE search tool
- Add bulk reassignment support for scoring app
- Add SSVC score to CSAF Vul Note
- Add CVSSv4 support
- Add support to remove KEV information nfrom ADP
- Change AdVISE to VINCE-NT
- Add support for CWE-noinfo
- Add new API route to auto-publish ADP containers
- Inactivity timer support

### Changed

- Django crtical upgrade
- Fix logout view
- Permissions within SSVC app
- Make split screen view default scoring view
- Use 1003 slice for CWEs in SSVC App

### Fixed

- Numerous CSAF issues
- Many bug fixes
- Dependency upgrades

## [1.6.0] - 2024-06-24

### Added


- Vulnrichment decision tree
- Add ticket api and email notifications
- Add coordinator case dashboard
- Allow groups to upload SBOM file and compare by PURL
- Scoring app and ADP publishing capability
- CPE support
- Vulnrichment github publishing support
- Vulnrichment reporting and insights
- KEV support
- Add CVE reassessment workflow
- Add SSVC app unit tests

### Changed

- Django 5 upgrade
- Load new cves from CVE github and NVD.

### Fixed
- Group Search
- Adjust permissions on components
- Fix issue with worker connections
- Numerous bug fixes



## [1.5.0] - 2024-01-30

### Added

- Add option to add defaultStatus when choosing component status (for publishing affected products to CVE)
- Add "Unknown" status and warnings to user for CVE/VEX status translation
- Add "publish" advisory option in order to add revision history in CSAF
- Show admin CVE users in CVE settings
- Add version numbers when showing component dependencies
- Show confirmation modal when unassigning user from case
- Messaging improvements to show number of messages and participants in list
- Allow cloning of components
- Use django-allauth built-in MFA instead of django-allauth-2fa package
- Add data validation for various API endpoints
- Add tag manager
- Use React router for system settings
- Add additional tests
- Consolidate React apps

### Changed

- Only import celery if using celery for worker
- Upgrade dependencies: jwcrypto, follow-redirects, jinja2, cryptography, axios,
- Email templates to prevent spam routing
- Status range form and validation to align with CVE JSON 5 Schema
- Add indexes to some tables to improve query times
- Adjust random_page_cost in psql settings to improve query time on SSD
- Move dependency add icon to dependency column in component table
- Switch order of mission prevalence and public well-being impact in SSVC scoring modal
- Remove SSVC vector

### Fixed

- Bug when tab selecting component status and then deleting
- Bug when multiple CVE accounts are active and user is trying to publish CVE
- Fix missing image in email notifications
- Fix bug when searching groups
- Auto-notify coordinators added to a case

## [1.4.0] - 2023-11-06

### Added

- Option to add component owner from component detail view
- Use the production CVE API by default if no CVE accounts exist
- Prompt user with case resolution when changing case status from active to inactive
- Allow users to configure case resolutions
- Allow file input as question type for forms
- Add react testing suite for testing react front-end components,
- Add worker framework to perform certain tasks asynchronously
- Add ability to add scheduled tasks through admin app
- Add ability to provide justifications for SSVC decisions
- Add pagination to groups view
- Auto generate logging config based on installed apps

### Changed

- Use React Router for front-end navigation to replace unnecessary django views
- Move CVE API settings into settings.py
- Use HTTP options request to populate certain drop-down forms.
- Upgrade dependencies: cryptography, certifi, quill-mention, urllib3, postcss, traverse
- Improvements to UI

### Fixed

- Bug in CVE publishing modal
- Issue with status badges when components have long names
- Issue in component edit modal
- Remove unused cvelib
- Fix SBOM download error due to download location
- Fix inbox app scrolling issue

## [1.3.0] - 2023-08-01

### Added

- Prompt user to notify case participants when case status changes to "Active"
- Allow case owners to update case report and view original report
- Improved error reporting
- Add case transfer API to allow instances to transfer cases
- Populate vulnerability information and status from CVE Entry
- Publish CVE ADP Container if ADP Role is available
- Add date scored to SSVC information
- New unit tests for testing case transfers
- Documentation for designing the reporting form
- Documentation for configuring federation and case transfers

### Changed

- Participant role from "vendor" to "supplier"
- Update case modified time on case related object additions, changes
- Removed CVE services option for group usage
- Vulnerability UI Form - consolidate options into one dropdown button
- Upgrade dependencies: semver, django, cryptography

### Fixed

- Changing role through CVE Services API
- Changing username through CVE Services API
- Updating CVE Entry through CVE Services API
- Date Public format when submitting CVE Entry

## [1.2.0] - 2023-06-06

### Added

- OpenVEX export
- Dependency upgrades (requests, django-ses, sqlparse, cryptography)
- Ability to remove component dependencies
- Import spdx file to load components
- SPDX export of components
- Adding images to posts/messages
- Allow case owners to un-archive a thread.
- Allow case participants to share status
- Component changelog/activity
- Add popover to case participant list to show included users
- Add justification option when case participant selects "Not Affected" as status
- Add view to see cases per group

### Changed

- Make archived threads read-only
- Component table searching and viewing improvements

### Fixed

- Scroll issues
- Only allow users to be tagged in post if they belong to case thread
- Fix loading threads when sending a message to the group
- Fix pagination on global search
- Allow MFA setup through admin login
- Case Participants should only have access to a case once notified
- Other bug fixes

### Removed

- Remove unnecessary group type

## [1.1.0] - 2023-05-11

### Added

- Activity logging
- CSAF export
- Configurable storage
- Allow anonymous reporting
- Add group, shared inbox
- Add calendar reminders for cases
- Email preferences
- Dependency upgrades
- Add Google ReCAPTCHA on sign up forms and vul reporting form

### Fixed

- Improve email notifications
- Improve pagination and infinite scroll
- Improve PDF rendering of case advisory
- Login/registration improvements depending on configuration
- Bug Fixes

### Removed

- Remove old jquery views and tables

## [1.0.0] - 2023-03-31

### Initial Public release
