import React, { useState, useEffect, useMemo } from 'react';
import {ListGroup, Badge, Tooltip, OverlayTrigger} from 'react-bootstrap';
import {format, formatDistance} from 'date-fns';
import DisplayStatus from './DisplayStatus';
import DisplayState from './DisplayState';
import DisplayCaseTags from './DisplayCaseTags';
import StandardPagination from './StandardPagination';
import {Link, useLocation} from "react-router"


export default function CaseList(props) {

    const {cases, count, page, setCurrentPage, emptymessage, crumbs, crumb_link, states, user} = props;
    
    return (
	<>
	    <div className="pb-5">
		<ListGroup as="ul">
		    {count > 0 ?
		     cases.map((c, index) => {
			 let date = new Date(c.created);
			 let last_modified = new Date(c.modified);
			 let timeago = formatDistance(last_modified, new Date(), {addSuffix: true});
			 let new_info = user?.welcome?.unseen_cases.some(y => y.case_id == c.case_id);
			 return (
			     
			 <ListGroup.Item
			     as="li"
			     key={`case-${index}`}
			     className={new_info && `new_case_activity`} 
			 >
			     <div className="ms-2 me-auto">
				 <div className="d-flex flex-wrap align-items-center gap-2">
				     <Link className="fw-bold search-result-link" to={`/cvdp/cases/${c.case_id}`} state={{breadcrumbs: crumbs, crumb_link:crumb_link}}>
				     {c.case_identifier}: {c.title} </Link>
				     <DisplayStatus
					 status= {c.status}
				     />
				     {states?.length > 0 &&
				      <DisplayState
					  state={c.state}
					  states={states}
				      />
				     }
				     {c.tags?.length > 0 &&
				      <DisplayCaseTags
					  tags = {c.tags}
				      />
				     }
				 </div>
				 {new_info &&
				  <Badge pill bg="success">New Activity</Badge>
				 }
				 {c.summary ?
				  <p className="text-muted mb-2 overflow-wrap">{c.summary}</p>
				  :
				  <>
				      {props.user && props.user.roles.includes('coordinator') &&
				       <>
					   {c.report ?
					    <p className="text-muted mb-2">
						{c.report.submitter && c.report.transfer &&
						 <> Transferred from {c.report.submitter} </>
						}
						{c.report.submitter ?
						 <> Submitted by {c.report.submitter} </>
						 :
						 "Submitted anonymously "
						}
						on {format(date, 'yyyy-MM-dd')}.
					    </p>
					    :
						<p className="text-muted mb-2">Created by {c.created_by} on {format(date, 'yyyy-MM-dd')}. </p>
					   }
					    </>
				      }
				  </>
				 }
				 <div className="d-flex gap-2 align-items-center">
				     {props.user && props.user.roles.includes('coordinator') &&
				     <span className="me-3 link-muted">
					 <OverlayTrigger overlay={<Tooltip>Tickets</Tooltip>}>
					     <Link to={`/cvdp/cases/${c.case_id}/dash`} state={{breadcrumbs: crumbs, crumb_link:crumb_link}}><i className="fas fa-ticket-alt me-1" aria-label="Tickets"></i> {c.stats.tickets}</Link>
					 </OverlayTrigger>
				     </span>
				     }
				     <span className="me-3 link-muted">
					 <OverlayTrigger overlay={<Tooltip>Posts</Tooltip>}>
					     <Link to={`/cvdp/cases/${c.case_id}/`} state={{breadcrumbs: crumbs, crumb_link:crumb_link}}><i className="fas fa-comment me-1" aria-label="Posts"></i>{c.stats.posts}</Link>
					 </OverlayTrigger>
				     </span>
				     {props.user && props.user.roles.includes('coordinator') &&
				     <span className="me-3 link-muted">
					 <OverlayTrigger overlay={<Tooltip>Notes</Tooltip>}>
					     <Link to={`/cvdp/cases/${c.case_id}/dash`} state={{breadcrumbs: crumbs, crumb_link:crumb_link}}><i className="fas fa-sticky-note me-1" aria-label="Notes"></i>{c.stats.notes}</Link>
					 </OverlayTrigger>
				     </span>
				     }
				     <span className="me-3 link-muted">
					 <OverlayTrigger overlay={<Tooltip>Vulnerabilities</Tooltip>}>
					     <Link to={`/cvdp/cases/${c.case_id}/?activeTab=addvuls`} state={{breadcrumbs: crumbs, crumb_link:crumb_link}}><i className="fas fa-bug me-1" aria-label="Vulnerabilities"></i>{c.stats.vuls}</Link>
					 </OverlayTrigger>
				     </span>
				     <span className="me-3 link-muted">
					 <OverlayTrigger overlay={<Tooltip>Case Participants</Tooltip>}>
					     <Link to={`/cvdp/cases/${c.case_id}/participants`} state={{breadcrumbs: crumbs, crumb_link:crumb_link}}><i className="fas fa-user me-1" aria-label="Participants"></i>{c.stats.participants}</Link>
					 </OverlayTrigger>
				     </span>
				 </div>
				 <div>
				     <small className="text-muted">
					 <>Updated on {format(last_modified, 'yyyy-MM-dd')}  ({timeago})</>
				     </small>
				 </div>
			     </div>
			 </ListGroup.Item>
			 )
		     })
		     :
		     <div>{emptymessage}</div>
		    }
		</ListGroup>
	    </div>
	    <div className="pagination-center">
		{count > 10 &&
		 <StandardPagination
		     itemsCount={count}
		     itemsPerPage="10"
		     currentPage={page}
		     setCurrentPage={setCurrentPage}
		 />
		}
	    </div>
	</>
    )

}


