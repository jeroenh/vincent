# CVD Triage

The triage process is the initial phase where a vulnerability report
is received, assessed, and prioritized before a fix is developed and
disclosed. Triage ensures that the coordination team validates the report,
understands the risk, and assigns the appropriate resources to resolve it
efficiently.

In VINCE-NT the triage process typically follows these steps:

## Initial Receipt and Acknowledgment

### Secure intake and Assignment

    A reporter/researcher reports the vulnerability through VINCE-NT's
    vulnerability reporting form or sends an email to the designated email
    address for VINCE-NT (configured in AWS SES).

#### Reporting Form Intake

     When a vulnerability report is submitted through VINCE-NT, a new unassigned
     case is created and is available in the Triage Queue. The initial triage is performed
     by the lead coordination team (configured in the admin pane under Global Settings).
     Only users in the lead coordination team will be able to view the unassigned cases
     in Triage.  If multiple coordination teams are available within the platform, a lead
     coordinator must first assign a coordination team to handle the case.  Once the coordination
     team has been selected, the case will be available in Triage to view by the selected coordination
     team. All members of a coordination team (coordinators and coordinator managers) have access
     to their team's triage queue.

     Once the coordination team reviews the case, they must assign a coordinator to the case.
     Only coordinator managers have the ability to assign a case.  If a team needs to transfer
     a case to a different coordination team, a coordinator manager can unassign their team and
     request the transfer to the lead coordination team. Once the transfer has been initiated,
     the lead coordination team will see the case in their Triage queue and can assign the case
     to a different coordination team.

#### Email Intake

     If a vulnerability report is received through email, the lead coordination team will
     see the report in the Triage Ticket queue. The lead coordinator can create a case from the
     ticket (by clicking on the ticket and using the "Create Case" button).  The case can then
     be assigned to a team and follows the same process as above.  In this scenario, the reporting
     form has not been populated but the coordinator has the option to take the information provided
     in the email ticket and adding a report to the case (use the vertical dots on the Case Details tab
     in the case and "Add Report").

#### Unassigning an Active Case

     A case may not be unassigned while it is "Active" and external parties have been notified.
     A coordination team that needs to transfer an active case should contact the lead coordination
     team to reassign the case.

## Validation

#### Initial Review

     Once the coordinator is assigned to the case, they should review the report to
     ensure it contains the necessary information (e.g. product affected, steps to reproduce,
     impact) and it falls within the team's scope. The coordinator might attempt to reproduce
     the reporter vulnerability using the provided PoC or instructions. If the report lacks
     sufficient detail, the coordinator may initiate communication with the reporter to ask for
     more information.

#### Non-Anonymous Contact (If Applicable):

    If the reporter isn't anonymous, the coordination team may invite the reporter
    to the case to confirm they've received the report and establish a communication
    channel.

## Analysis and Prioritization

    The coordinator should begin a technical assessment and rate the severity (SSVC, CVSS).
    They may begin writing the vulnerability(s) descriptions and identifying the impact
    on users and systems.

## Identifying Affected Parties

    The coordinator should identify the appropriate vendors and organizations to notify
    to begin the coordination phase to synchronize remediation and disclousre timelines with
    all affected stakeholders.


     
