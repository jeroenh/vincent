import React, { useState, useEffect, useMemo } from 'react';
import CaseThreadAPI from './ThreadAPI';
import { format, formatDistance } from 'date-fns'
import {Alert,Accordion,  OverlayTrigger, Tooltip, Table, Badge, Card, Row, Col, Dropdown, DropdownButton, Button, Form, InputGroup} from 'react-bootstrap';
import DeleteConfirmation from "./DeleteConfirmation";
import { useTable, useSortBy, useRowSelect } from 'react-table';
import {useParams, useNavigate, Link, useLocation} from "react-router"
import ComponentAPI from './ComponentAPI';
import DisplayVulStatus from './DisplayVulStatus';
import EditStatusModal from './EditStatusModal';
import StatusModal from './StatusModal';
import InfiniteScroll from "react-infinite-scroll-component";

import '../css/casethread.css';

const threadapi = new CaseThreadAPI();
const componentapi = new ComponentAPI();


const DisplayVulStatusSummary = (props) => {

    const {status} = props;

    return (
        <div className="gap-1">
            {status.map((b, index) => {

                return (
                    <DisplayVulStatus
                        key={`${b.status}-${index}`}
                        status={b.status}
                        count = {b.count}
                    />
                )})
            }
        </div>
    )

}

const SORT_CHOICES = [
    {val: 'current_revision__modified', desc: "Most Recent"},
    {val: 'component__product_info__supplier', desc: "Alphabetical by Supplier"},
    {val: 'component__name', desc: "Alphabetical by Component"},
]

    

const Searchbar = ({ onChange, value }) => {
    return (
	<>
	    <Form.Control
		placeholder="Search Components"
		aria-label="Search Components"
		aria-describedby="searchcomponents"
		value={value}
		onChange={onChange}
            />
            <Button variant="btn btn-outline-secondary" id="button-addon2" type="submit">
		<i className="fas fa-search"></i>
            </Button>
	</>
  );
};


const CaseStatusTable = () => {

    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [error, setError] = useState(null);
    const [searchVal, setSearchVal] = useState("");
    const [crumbs, setCrumbs] = useState(location.state?.breadcrumbs);
    const [crumbLink, setCrumbLink] = useState(location.state?.crumb_link);
    const [caseInfo, setCaseInfo] = useState(location.state?.caseInfo);
    const [isLoading, setIsLoading] = useState(true);
    const [preFilter, setPreFilter] = useState([]);
    const [caseComponents, setCaseComponents] = useState([]);
    const [showEditStatusModal, setShowEditStatusModal] = useState(false);
    const [editStatus, setEditStatus] = useState(null);
    const [component, setComponent] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [displayConfirmationModal, setDisplayConfirmationModal] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState(null);
    const [removeID, setRemoveID] = useState(null);
    const [nextUrl, setNextUrl] = useState(null);
    const [reqUser, setReqUser] = useState(null);
    const [clone, setClone] = useState(false);
    
    function editStatusNow(c, v) {
	setEditStatus(v);
	setComponent(c);
	setShowEditStatusModal(true);
    }
    
    function cloneStatus(c, v) {
        /*checked vuls is the id of the actual status */
        setEditStatus(v);
	setComponent(c);
	setShowEditStatusModal(true);
	setClone(true);
    }
    


    function viewStatusDetails(c, v) {
        setEditStatus(v);
        setComponent(c);
        setShowStatusModal(true);
    }

    const hideConfirmationModal = () => {
        setDisplayConfirmationModal(false);
    }

    function removeStatus(id) {
        setRemoveID(id);
        setDeleteMessage("Are you sure you want to remove this status?");
        setDisplayConfirmationModal(true);
    };

    const submitRemoveStatus = (id) => {
        componentapi.removeStatus(id).then((response) => {
            getSelectedComponents();
        }).catch(err => {
            setErrorMessage(`Error removing component status: ${err.message}. Are you the case owner?`);
            setDisplayErrorModal(true);
            console.log(err);
        });
        setDisplayConfirmationModal(false);
    }

    const filterData = (value) => {

	let sv = encodeURIComponent(value);
        setIsLoading(true);
	if (value) {
            let urlstr = `?search=${sv}`
            getSelectedComponents(urlstr);
	} else {
	    getSelectedComponents(null);
	}

	/*
	if (value === "") {
	    setCaseComponents(preFilter);
        } else {
	    console.log(value);
	    console.log(preFilter);
	    const result = preFilter.filter((item) => {
		return (
		    item.component.name.toString()
			.toLowerCase()
			.indexOf(value.toLowerCase()) > -1
			||
			item.component.owner?.name?.toString()
			.toLowerCase()
			.indexOf(value.toLowerCase()) > -1
		)
            });
	    setCaseComponents(result);
	}*/
    }


    // Searchbar functionality
    const onSearchbarChange = (e) => {
        const value = e.target.value
        setSearchVal(value);
        filterData(value);
    }


    const ActionColumn = (props) => {
        const {component, vulstatus, user} = props;

	const groups = user.groups?.map(x => x.name)
	
	return (
	    <div className="text-nowrap">
		{user.role === "owner" || groups.includes(component.component.owner?.name) ?
		 <>
		     <Button variant="btn-icon px-1 edit-status-btn" onClick={(e)=>editStatusNow(component, vulstatus)}>
			 <i className="fas fa-edit"></i>
                     </Button>
		     <Button
			 variant="btn-icon px-1 clone-status-btn"
			 onClick={(e) => cloneStatus(component, vulstatus)}
                     >                                                                                                                                   
			 <i className="fas fa-copy"></i>                                                                                                 
                     </Button>
		 </>
		 :
		 ""
		}
                <Button variant="btn-icon px-1 view-status-btn" onClick={(e)=>viewStatusDetails(component, vulstatus)}>
                    <i className="fas fa-search-plus"></i>
                </Button>
		{user.role === "owner" || groups.includes(component.component.owner?.name) ?
                 <Button variant="btn-icon px-1 rm-status-btn" onClick={(e)=>removeStatus(vulstatus.id)}>
                     <i className="fas fa-trash"></i>
                 </Button>
		 :
		 ""
		}

            </div>

	)
    }

    const hideEditStatusModal = () => {
        setShowEditStatusModal(false);
	getSelectedComponents();
	setClone(false);
    }

    const hideStatusModal = () => {
	setShowStatusModal(false);
    }

    const getSelectedComponents = async (urlstr) => {
        console.log("fetching case components");
	await componentapi.getComponentStatusOrder(caseInfo, urlstr).then((response) => {
            console.log("COMP STATUS", response);
	    if (response.results) {
		setCaseComponents(response.results);
		setNextUrl(response.next);
		setPreFilter(response.results);
	    }
	    setIsLoading(false);
        }).catch(err => {
            console.log('Error:', err)
            if (err.response.status == 403 || err.response.status==404) {
                navigate("../err");
            }

            setError(`Error retrieving component status: ${err.message}`);
	})
    }

    const fetchMoreStatus = async () => {

	await componentapi.getComponentNext(nextUrl).then((response) => {
	    if (response.results) {
		setCaseComponents(caseComponents.concat(response.results));
		setNextUrl(response.next);
		setPreFilter(caseComponents.concat(response.results));
	    }
            setIsLoading(false);
	}).catch(err => {
            console.log('Error:', err)
            if (err.response.status == 403 || err.response.status==404) {
                navigate("../err");
            }

            setError(`Error retrieving component status: ${err.message}`);
        })
	
    };


       // Async Fetch
    const fetchInitialData = async () => {
	if (caseInfo == null) {
            await threadapi.getCase({'case': id}).then((response) => {
		setCaseInfo(response);
	    }).catch(err => {
		console.log('Error:', err)
		if (err.response.status == 403 || err.response.status==404) {
                    navigate("../err");
		}

		setError(`Error retrieving component status: ${err.message}`);

	    });
	} else {
	    getSelectedComponents(null);
	}
    }

    function handleSortSelect(evt, evtKey) {
	const urlstr = `?ordering=${evt}`;
	setIsLoading(true);
	getSelectedComponents(urlstr);
	
    };


    const fetchUser = async () => {
	await threadapi.getUserCaseState({'case': id}).then((response) => {
            setReqUser(response);
        })
    }

    useEffect(() => {
	if (caseInfo) {
	    if (reqUser == null) {
		fetchUser();
	    }
	    getSelectedComponents(null);
	}
    }, [caseInfo]);

    useEffect(() => {
        fetchInitialData();
    }, []);


    return (
	<>
	    {caseInfo ?
	     <>
		 {crumbs ?

		  <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">{crumbs[0]} /</span> <Link to={crumbLink} >{crumbs[1]}</Link> / <Link to={'..'}>{caseInfo.case_identifier} {caseInfo.title}</Link> / Status</h4>
                      :
                  <h4 className="fw-bold py-3 mb-4"><span className="text-muted fw-light">Cases /</span> <Link to={'..'}>{caseInfo.case_identifier} {caseInfo.title}</Link> / Status</h4>
                 }

		 <Card>
		     <Card.Header>
			 <InputGroup>
			     <Searchbar
				 onChange={onSearchbarChange}
				 value={searchVal}
			     />
			     <DropdownButton
				 onSelect={handleSortSelect}
				 variant="outline-primary"
				 title={<i className="fas fa-sort"></i>}
				 id="input-group-dropdown-1"
			     >
				 {SORT_CHOICES.map((choice) => (
                                     <Dropdown.Item eventKey={choice.val} key={choice.val} value={choice.val}>{choice.desc} </Dropdown.Item>
                                 ))}
			     </DropdownButton>
			     <DropdownButton
                                 variant="outline-primary"
                                 title={<i className="fas fa-filter"></i>}
                                 id="input-group-dropdown-2"
                             >                                                                                                                                                         <Dropdown.Item> </Dropdown.Item>
                             </DropdownButton>
			 </InputGroup>

		     </Card.Header>


		     {isLoading ?
		      <div className="text-center">
			  <div className="lds-spinner"><div></div><div></div><div></div></div>
		      </div>
		      :
		     <Card.Body>
			 <InfiniteScroll
			     dataLength={caseComponents.length}
                             next={fetchMoreStatus}
                             hasMore={nextUrl?true:false}
                             loader={
                                 <div className="text-center">                                       
                                     <div className="lds-spinner">                                   
                                         <div></div>                                                 
                                             <div></div>                                                 
                                         <div></div>                                                 
                                     </div>                                                          
                                 </div>
                             }
                         >
			     <Row xs={1} md={2} className="g-4 mx-2">

			     {caseComponents.map((c, idx) => (
				 <Col key={`come-${idx}`}>
				     <Accordion>
				     <Accordion.Item className="card mt-2" eventKey={`c-${idx}`} key={`c-${idx}`}>
					 <Accordion.Header className="status-accordion">
					     <div className="d-flex justify-content-between align-items-center">
					     <div>{c.component.owner ?
						    `${c.component.owner.name}/`
						    :
						    <>
							<OverlayTrigger overlay={<Tooltip>No supplier provided for component. CSAF Advisory will not include status without supplier.</Tooltip>}>
							    <i className="fas fa-exclamation-triangle warningtext"></i>
							</OverlayTrigger>
							{" "}
						    </>}
						 {c.component.name}
					     </div>
					     <DisplayVulStatusSummary
						 status = {c.summary}
					     />
					     </div>
					 </Accordion.Header>
					 <Accordion.Body>
					     {c.vuls.map((v, index) => (
						 <div key={`vul-${index}`}>
						     <div className="d-flex justify-content-between">
							 <p className="lead">{ v.vul.vul }{v.vul.title && `: ${v.vul.title}`}</p>
							 <ActionColumn
							     component = {c}
							     vulstatus={v}
							     user={reqUser}
							 />
							 
						     </div>
						     
						     {v.status.map((status, index) => (
							 <div key={`${v.id}-${index}`}>
							     <div className="d-flex justify-content-between border-top py-2 mb-2">
								 {reqUser.role === "owner" ?
								  <a href={`/cvdp/components/${c.component.id}/`}>{c.component.name} {status.version_value} {status.version_range ? status.version_range : ""} {status.version_end_range ? status.version_end_range : "" } </a>
								  :
								  <span>
								      {c.component.name} {status.version_value} {status.version_range ? status.version_range : ""} {status.version_end_range ? status.version_end_range : "" }
								  </span>
								 }
								 <span>{format(new Date(v.modified),'yyyy-MM-dd')}</span>
								 <DisplayVulStatus
								     status={status.status}
								 />
							     </div>
							 </div>
						     ))}
						 </div>
					     ))}
					 </Accordion.Body>
				     </Accordion.Item>
				     </Accordion>
				 </Col>
			     ))}
			     </Row>
			 </InfiniteScroll>

		     </Card.Body>
		     }
		     </Card>
		 <EditStatusModal
		     showModal = {showEditStatusModal}
		     hideModal = {hideEditStatusModal}
		     component = {component}
		     compstatus = {editStatus}
		     user = {reqUser}
		     clone={clone}
		 />
		 <StatusModal
                     showModal = {showStatusModal}
                     hideModal = {hideStatusModal}
                     component = {component}
                     status = {editStatus}
		     user={reqUser}
		 />
		 <DeleteConfirmation
                     showModal={displayConfirmationModal}
                     confirmModal={submitRemoveStatus}
                     hideModal={hideConfirmationModal}
		     id={removeID}
                     message={deleteMessage} />
             </>
	     :
	     <></>
	    }
	</>
    )
}

export default CaseStatusTable;
