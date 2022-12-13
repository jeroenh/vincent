import React, { useRef, useState, useEffect } from 'react'
import {Card, Badge, Alert, DropdownButton, Dropdown, InputGroup, FloatingLabel, Form, Stack, Container, Row, Col, Tab, Tabs, Nav, Button} from 'react-bootstrap';
import {useLocation, useSearchParams} from 'react-router';
import {Link} from "react-router";
import CaseThreadAPI from './ThreadAPI';
import ComponentAPI from './ComponentAPI';
import '../css/casethread.css';
import {format, formatDistance} from 'date-fns';
import VulAddForm from './VulAddForm';
import StatusAddForm from './StatusAddForm';
import CaseSummaryApp from './CaseSummaryApp';
import ViewReport from './ViewReport';
import TagModal from './TagModal';

const threadapi = new CaseThreadAPI();
const componentapi = new ComponentAPI();

const CaseDetailApp = (props) => {

    const location = useLocation();
    let [searchParams, setSearchParams] = useSearchParams();
    const [caseInfo, setCaseInfo] = useState(null);
    const [caseTitle, setCaseTitle] = useState("");
    const [invalidTitle, setInvalidTitle] = useState(false);
    const [caseSummary, setCaseSummary] = useState(" ");
    const [feedback, setFeedback] = useState(null);
    const [activeTab, setActiveTab] = useState(searchParams.get('activeTab') || "report");
    const [vuls, setVuls] = useState([]);
    const [transfers, setTransfers] = useState([]);
    const [owner, setOwner] = useState(false);
    const [status, setStatus] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    const [displayTagModal, setDisplayTagModal] = useState(false);
    
    const statusRef = useRef(null);


    useEffect(() => {
	if (!(['coordinator', 'owner'].includes(props.user.role))) {
	    /*if (props.caseInfo.status === "Pending") {
		setCaseInfo(null);
	    } else {*/
	    setCaseInfo(props.caseInfo);
	    //}

	    setOwner(false);
	} else {
	    if (props.user.role === "owner") {
		setOwner(true);
	    } else {
		setOwner(false);
	    }
	    if (props.user.last_viewed) {
		setShowAlert(false);
	    } else {
		setShowAlert(true);
	    }
	    setCaseInfo(props.caseInfo);
	    setCaseTitle(props.caseInfo.title);
	    setCaseSummary(props.caseInfo.summary || "");
	}
    }, [props.caseInfo, props.user]);


    const saveTags = async (tags) => {

        const formDataObj = {};
        formDataObj['tags'] = tags.map(t => t.tag);;

        await threadapi.updateCase(props.caseInfo, formDataObj).then((response) => {
            let f = <Alert variant="success">Got it! Thanks for adding more information!</Alert>;
            setFeedback(f);
            hideTagModal();
            props.updateStatus();
            //props.updateActivity();                                                                                                   
        }).catch(err => {
            console.log(err);
            hideTagModal();
            let f= <Alert variant="danger">An error occurred: {err.response.data.detail}. Make sure you are assigned to the case before editing.</Alert>
            setFeedback(f);
        })

    }

    const hideTagModal = () => {
        setDisplayTagModal(false);
    }


    const handleSubmit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.target),
              formDataObj = Object.fromEntries(formData.entries());
	if (JSON.stringify(formDataObj) === '{}') {
	    setActiveTab("addcasedetails")
	    return;
	}

        threadapi.addCaseReport(caseInfo, formDataObj).then((response) => {
	    let f = <Alert variant="success">Got it! Your report has been saved.</Alert>
	    setFeedback(f);
	    props.updateStatus();

	}).catch(err => {
	    console.log(err);
	    let f = <Alert variant="danger">An error occurred: {err.response.data.message}</Alert>
	    setFeedback(f);
	});
    }

    const fetchTransfers = async () => {

        if (['coordinator', 'owner'].includes(props.user.role)) {
	    await componentapi.getCompStatusUploads(caseInfo).then((response) => {
		setTransfers(response);
            }).catch(err => {
		console.log('Error:', err)
            })
	}
    }


    const fetchInitialData = async () => {

        await threadapi.getVuls(caseInfo).then((response) => {
            setVuls(response);
        }).catch(err => {
	    console.log(err);
	    if (err.response?.data?.message) {
		setFeedback(<Alert variant="danger">An error occurred: {err.response?.data.message}</Alert>);
	    } else {
		setFeedback(<Alert variant="danger">An error occurred.</Alert>);
	    }
	});
    }

    useEffect(() => {
	if (caseInfo) {
	    fetchInitialData();
	    fetchTransfers();
	    if (caseInfo.report == null && !searchParams.get('activeTab')) {
		setActiveTab("addcasedetails");
	    }

	}
    }, [caseInfo]);

    useEffect(() => {
	if (vuls) {
	    let test = vuls.some(item => item.affected_products.length > 0);
	    setStatus(test);
	}
    }, [vuls]);

    const submitDetails = async (event) => {
	event.preventDefault();
	const formData = new FormData(event.target),
              formDataObj = Object.fromEntries(formData.entries());
	await threadapi.updateCase(props.caseInfo, formDataObj).then((response) => {
	    let f = <Alert variant="success">Got it! Thanks for adding more information!</Alert>;
	    setFeedback(f);
	    props.updateStatus();
	    //props.updateActivity();
	}).catch(err => {
	    console.log(err);
	    let f= <Alert variant="danger">An error occurred: {err.response.data.detail}. Make sure you are assigned to the case before editing.</Alert>
	    setFeedback(f);
	})
    };

    const setActiveTabNow = (props) => {
	setSearchParams((searchParams) => {
	    searchParams.set("activeTab", props);
	    return searchParams;
	})
	//window.history.pushState({}, '', `?activeTab=${props}`);
	setFeedback(null);
	setActiveTab(props);
    }

    useEffect(() => {
	if (searchParams.get('activeTab')) {
	    setActiveTab(searchParams.get('activeTab'));
	}
    }, [searchParams]);
    
    return (
	caseInfo && owner ?
	    <div className="nav-align-top mb-4">
		{caseInfo.owners.length ?
		 ""
		 :
		 <Alert variant="warning">This case is currently unassigned. Assign the case to yourself before editing case details.</Alert>
		}
		<Tab.Container
                    defaultActiveKey={activeTab}
		    activeKey={activeTab}
                    id="report"
                    className="mb-3"
		    onSelect={setActiveTabNow}
                >
                    <Nav variant="pills" className="mb-3" fill justify>
			{caseInfo.report &&
			<Nav.Item>
                            <Nav.Link eventKey="report"><i className="fas fa-file-alt"></i>  Original Report</Nav.Link>
                        </Nav.Item>
			}
			<Nav.Item>
                            <Nav.Link eventKey="addcasedetails">
				{caseSummary && caseTitle ?
				 <span className="text-nowrap">Case Details <i className="fas fa-check text-success"></i></span>
				 :
				 <>
				     <i className="fas fa-plus"></i>  Add Case Details
				 </>
				}</Nav.Link>
                        </Nav.Item>
			<Nav.Item>
                            <Nav.Link eventKey="addvuls">
				{vuls.length > 0 ?
				 <>
				     <span className="text-nowrap">Vulnerabilities <Badge bg="info" pill>{vuls.length}</Badge></span>
				 </>
				 :
				 <>
				     <i className="fas fa-plus"></i>  Add Vulnerabilties
				 </>
				}
			    </Nav.Link>

                        </Nav.Item>

			<Nav.Item>
                            <Nav.Link eventKey="addstatus">
				{transfers.length > 0 ?
				 <span className="text-nowrap">Status <Badge bg="warning" pill>{transfers.length}</Badge></span>
				 :
				 <>
				     {status ?
				      <span className="text-nowrap">Status
					  {props.metadata?.unapproved > 0 ?
					   <Badge className="ms-2" bg="warning" pill>{props.metadata.unapproved}</Badge>
					   :
					   <i className="fas fa-check text-success ms-2"></i>
					  }
				      </span>
				      :
				      <>
					  <i className="fas fa-plus"></i>  Add Status
				      </>
				     }
				 </>
				}
			    </Nav.Link>
                        </Nav.Item>

		    </Nav>
		    <Tab.Content>
			{caseInfo.report &&
			 <Tab.Pane eventKey="report">
			     <ViewReport
				 report={caseInfo.report}
				 owner={true}
				 caseid = {caseInfo.case_id}
			     />
			 </Tab.Pane>
			}
			<Tab.Pane eventKey="addcasedetails">

			    <div className="d-flex justify-content-between align-items-start mb-2">
				<Stack direction="horizontal" gap={2}>
				    {caseInfo.tags?.length > 0 &&
				     <>
					 <Form.Label className="mb-0">Tags:</Form.Label> {caseInfo.tags.map((tag, index) => (
					     <Badge key={`tag-${index}`}  bg="primary" onClick={(e)=>setDisplayTagModal(true)}>{tag}</Badge>
					 ))}
				     </>
				    }
				     <TagModal
                                          showModal = {displayTagModal}
                                          hideModal = {hideTagModal}
                                          dataType = "case"
                                          options = {[]}
                                          tags = {caseInfo.tags}
                                          submitTags = {saveTags}
                                      />     
				</Stack>
				 <DropdownButton variant="btn p-0"
						 id="detail-dropdown"
						 title={<i className="bx bx-dots-vertical-rounded" title="Report Management"></i>}
				 >
				     {caseInfo.report ? ""
				      :
				      <Dropdown.Item eventKey="addreport" href={`/cvdp/cases/${caseInfo.case_id}/report/edit/`}>Add Report</Dropdown.Item>
				     }
				     <Dropdown.Item eventKey="tagCase" onClick={()=>(setDisplayTagModal(true))}>Tag Case</Dropdown.Item> 
					 
				 </DropdownButton>
			    </div>
			    
			    {feedback &&
			     feedback
			    }
			    {showAlert &&
			     
			     <Alert variant="warning" dismissible onClose={()=>setShowAlert(false)}>
				 <Alert.Heading>No Case Report</Alert.Heading>
				 This case was created manually and does not have a report associated with it.  Do you want to add one? You will have the option to add one later.
				 <div className="mt-2 d-flex align-items-center"><a className="btn btn-primary btn-sm" href={`/cvdp/cases/${caseInfo.case_id}/report/edit/`}>Yes</a></div>
			     </Alert>
			    }

			    <Form onSubmit={(e)=>submitDetails(e)} id="detailsform">
				<Form.Group className="mb-3" controlId="case_title">
				    <Form.Label as="h6">Case Title</Form.Label>
				    <Form.Text className="text-muted">
					This title is used in advisories and CSAF documents.
				    </Form.Text>
				    <Form.Control name="title" title="Provide case title" data-testid="case_title_input" isInvalid={invalidTitle} value={caseTitle} onChange={(e)=>setCaseTitle(e.target.value)}/>
				    {invalidTitle &&
				    <Form.Text className="error">
					This field is required.
				    </Form.Text>
				    }
				</Form.Group>
				<Form.Group className="mb-3" controlId="case_summary">
				    <Form.Label as="h6">Summary</Form.Label>
				    <Form.Text className="text-muted">
					Add a summary of this case (optional)
				    </Form.Text>
				    <Form.Control name="summary" as="textarea" title="Provide case summary" rows={3}  value={caseSummary} onChange={(e)=>setCaseSummary(e.target.value)}/>
				</Form.Group>
				<Button variant="primary" type="submit">
				    Submit
				</Button>
			    </Form>
			</Tab.Pane>
			<Tab.Pane eventKey="addvuls">
			    <VulAddForm
				caseInfo = {caseInfo}
				vuls = {vuls}
				updateVuls = {fetchInitialData}
				user={props.user}
			    />

			</Tab.Pane>
			<Tab.Pane eventKey="addstatus" ref={statusRef}>
			    <StatusAddForm
				caseInfo = {caseInfo}
				vuls = {vuls}
				transfers = {transfers}
				user={props.user}
				active={activeTab == "addstatus" ? true : false}
				updateVuls = {fetchInitialData}
				scrollRef = {statusRef}
			    />
			</Tab.Pane>
		    </Tab.Content>
		</Tab.Container>
	    </div>
	:
	<>
	{caseInfo ?
	 <CaseSummaryApp
	     caseInfo = {caseInfo}
	     vuls={vuls}
	     user={props.user}
	 />

	 :
	 <div className="text-center">
             <div className="lds-spinner"><div></div><div></div><div></div></div>
         </div>
	}
	</>
    )
}

export default CaseDetailApp;
