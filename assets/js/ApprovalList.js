import React, { useState, useEffect, useMemo } from 'react';
import {ListGroup, Badge, Tooltip, OverlayTrigger} from 'react-bootstrap';
import {format, formatDistance} from 'date-fns';
import DisplayStatus from './DisplayStatus';
import DisplayState from './DisplayState';
import StandardPagination from './StandardPagination';
import {Link, useLocation} from "react-router"
import DisplayLogo from "./DisplayLogo";

export default function ApprovalList(props) {

    const {approvals, crumbs, crumb_link, states} = props;

    return (
	<>
	    <div className="pb-5">
		<ListGroup as="ul">
		    {approvals.map((c, index) => {
			let date = new Date(c.created);
			let timeago = formatDistance(date, new Date(), {addSuffix: true});
			
			return (
			    
			    <ListGroup.Item
				as="li"
				key={`case-${index}`}
			    >
			     <div className="ms-2 me-auto">
				 <div className="d-flex align-items-start gap-2">
				     {/*<span title={`A ${c.case.owner[0]?.name} case`}>
					 <DisplayLogo
					     name={c.case.owner[0]?.name}
					     photo={c.case.owner[0]?.photo}
					     color={c.case.owner[0]?.logocolor}
					 />
					 </span>*/}
				     {c.vulnerability ?
				      <Link className="fw-bold fs-big" to={`/cvdp/cases/${c.case.case_id}?activeTab=addvuls&cve=${c.vulnerability.cve}`} state={{breadcrumbs: crumbs, crumb_link:crumb_link, approval:c, caseInfo: c.case}}>
					  CVE {c.vulnerability.cve}
				      </Link>
				      :
				      <Link className="fw-bold fs-big" to={`/cvdp/cases/${c.case.case_id}/advisory/preview/`} state={{breadcrumbs: crumbs, crumb_link:crumb_link, approval:c, caseInfo: c.case}}>
					  {c.case.case_identifier}: {c.case.title}
				      </Link>
				     }
				 </div>
				 {c.vulnerability ?
				  <p>CVE-{c.vulnerability?.cve} review requested by {c.user.name}.</p>
				  :
				  <p>Advisory {c.advisory_version} review requested by {c.user.name}.</p>
				 }
				 <small className="text-muted">
				     <>Requested on {format(date, 'yyyy-MM-dd')}  ({timeago})</>
				 </small>
			     </div>
			 </ListGroup.Item>
			 )
		     })
		    }
		</ListGroup>
	    </div>
	</>
    )

}


